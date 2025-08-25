import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import minimatch from "minimatch";

interface Rule {
  pattern: string;
  owners: string[];
}

class CodeownersExtension {
  private rules: Rule[] = [];
  private statusBarItem: vscode.StatusBarItem;
  private outputChannel: vscode.OutputChannel;
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel("CODEOWNERS Status");
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
  }

  public activate(context: vscode.ExtensionContext): void {
    try {
      this.outputChannel.show();
      this.log("CODEOWNERS Status extension activated");

      // Add disposables to context
      context.subscriptions.push(this.statusBarItem);
      context.subscriptions.push(...this.disposables);

      // Load CODEOWNERS at startup
      this.loadCodeowners();

      // Update when active editor changes
      this.disposables.push(
        vscode.window.onDidChangeActiveTextEditor(() => this.updateStatusBar())
      );

      // Update when files change
      this.disposables.push(
        vscode.workspace.onDidSaveTextDocument((doc) => {
          if (doc.fileName.toLowerCase().includes("codeowners")) {
            this.loadCodeowners();
            this.updateStatusBar();
          }
        })
      );

      this.updateStatusBar();
      
      console.log("CODEOWNERS Status extension activated successfully");
    } catch (error) {
      console.error("Error activating CODEOWNERS Status extension:", error);
      this.log(`Error activating CODEOWNERS Status extension: ${error}`, 'error');
    }
  }

  public deactivate(): void {
    this.disposables.forEach(disposable => disposable.dispose());
    this.disposables = [];
    this.outputChannel.dispose();
  }

  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    this.outputChannel.appendLine(logMessage);
    
    // Log errors to console for debugging
    if (level === 'error') {
      console.error(logMessage);
    }
  }

  private loadCodeowners(): void {
    this.rules = [];
    
    if (!vscode.workspace.workspaceFolders?.length) {
      this.log("No workspace folders found");
      return;
    }

    const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    this.log(`Workspace root: ${rootPath}`);

    const codeownersPath = this.findCodeownersFile(rootPath);
    if (!codeownersPath) {
      this.log("No CODEOWNERS file found");
      return;
    }

    const fileContent = this.readCodeownersFile(codeownersPath);
    if (!fileContent) {
      return;
    }

    this.parseCodeownersContent(fileContent);
  }

  private findCodeownersFile(rootPath: string): string | null {
    const possiblePaths = [
      path.join(rootPath, "CODEOWNERS"),
      path.join(rootPath, ".github", "CODEOWNERS"),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
    return null;
  }

  private readCodeownersFile(filePath: string): string | null {
    try {
      const fileContent = fs.readFileSync(filePath, "utf8");
      this.log(`Loaded CODEOWNERS from: ${filePath}`);
      this.log(`File size: ${fileContent.length} characters`);
      return fileContent;
    } catch (error) {
      this.log(`Error reading CODEOWNERS file: ${error}`, 'error');
      return null;
    }
  }

  private parseCodeownersContent(content: string): void {
    const lines = content.split("\n");
    this.log(`Total lines in CODEOWNERS: ${lines.length}`);
    
    let validRules = 0;
    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }

      const [pattern, ...owners] = line.split(/\s+/);
      if (!pattern || owners.length === 0) {
        continue;
      }

      this.rules.push({ pattern, owners });
      validRules++;
      
      // Log first few rules to verify parsing
      if (validRules <= 5) {
        this.log(`Rule ${validRules}: pattern="${pattern}", owners=[${owners.join(", ")}]`);
      }
    }
    
    this.log(`Loaded ${this.rules.length} valid rules from CODEOWNERS`);
  }

  private findOwners(filePath: string): string[] {
    if (!this.rules.length) {
      this.log("No rules loaded, returning empty array");
      return [];
    }

    // Normalize path to workspace root relative
    if (!vscode.workspace.workspaceFolders?.length) {
      return [];
    }
    
    const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const relative = path.relative(root, filePath);
    
    this.log(`Looking for owners for file: ${filePath}`);
    this.log(`Relative path: ${relative}`);
    this.log(`Total rules to check: ${this.rules.length}`);

    let matchedOwners: string[] = [];

    for (const rule of this.rules) {
      try {
        const isMatch = minimatch(relative, this.normalizePattern(rule.pattern), { dot: true });
        if (isMatch) {
          this.log(`Pattern "${rule.pattern}" matched for "${relative}"`);
          matchedOwners = rule.owners;
        }
      } catch (error) {
        this.log(`Error matching pattern "${rule.pattern}": ${error}`, 'error');
      }
    }

    this.log(`Final matched owners: ${matchedOwners.join(", ")}`);
    return matchedOwners;
  }

  private normalizePattern(pattern: string): string {
    let p = pattern.trim();

    // Strip leading slash (GitHub style vs minimatch)
    if (p.startsWith("/")) {
      p = p.slice(1);
    }
  
    // If ends with "/", treat as directory → add **
    if (p.endsWith("/")) {
      p += "**";
    }
  
    return p;
  }

  private updateStatusBar(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.log("No active editor, hiding status bar");
      this.statusBarItem.hide();
      return;
    }

    this.log(`Updating status bar for: ${editor.document.fileName}`);
    const owners = this.findOwners(editor.document.fileName);
    
    if (owners.length > 0) {
      this.statusBarItem.text = `👥 Owners: ${owners.join(", ")}`;
      this.statusBarItem.show();
      this.log(`Status bar updated with owners: ${owners.join(", ")}`);
    } else {
      this.statusBarItem.text = `👥 No owners found`;
      this.statusBarItem.show();
      this.log(`Status bar updated: No owners found`);
    }
  }
}

// Extension instance
let extension: CodeownersExtension;

export function activate(context: vscode.ExtensionContext): void {
  extension = new CodeownersExtension();
  extension.activate(context);
}

export function deactivate(): void {
  if (extension) {
    extension.deactivate();
  }
}