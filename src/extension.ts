import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import minimatch from "minimatch";

interface Rule {
  pattern: string;
  owners: string[];
}

interface ExtensionConfig {
  showDebugLogs: boolean;
  statusBarPriority: number;
  additionalCodeownersPaths: string[];
}

class CodeownersExtension {
  private rules: Rule[] = [];
  private statusBarItem: vscode.StatusBarItem;
  private outputChannel: vscode.OutputChannel;
  private disposables: vscode.Disposable[] = [];
  private lastCodeownersModified: number = 0;
  private isInitialized: boolean = false;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel("CODEOWNERS Status");
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      this.getConfig().statusBarPriority
    );
  }

  public activate(context: vscode.ExtensionContext): void {
    try {
      this.outputChannel.show();
      this.log("CODEOWNERS Status extension activated");

      // Validate workspace
      if (!this.validateWorkspace()) {
        this.log("Workspace validation failed", 'warn');
        return;
      }

      // Add disposables to context
      context.subscriptions.push(this.statusBarItem);
      context.subscriptions.push(...this.disposables);

      // Load CODEOWNERS at startup
      this.loadCodeowners();

      // Update when active editor changes
      this.disposables.push(
        vscode.window.onDidChangeActiveTextEditor(() => this.updateStatusBar())
      );

      // Only reload CODEOWNERS when it changes, not on every file save
      this.disposables.push(
        vscode.workspace.onDidSaveTextDocument((doc) => {
          if (this.isCodeownersFile(doc.fileName)) {
            this.loadCodeowners();
          }
        })
      );

      this.updateStatusBar();
      this.isInitialized = true;
      
      this.log("CODEOWNERS Status extension activated successfully");
    } catch (error) {
      const errorMessage = `Error activating CODEOWNERS Status extension: ${error}`;
      vscode.window.showErrorMessage(errorMessage);
      this.log(errorMessage, 'error');
    }
  }

  public deactivate(): void {
    try {
      this.disposables.forEach(disposable => {
        try {
          disposable.dispose();
        } catch (error) {
          this.log(`Error disposing disposable: ${error}`, 'warn');
        }
      });
      this.disposables = [];
      this.outputChannel.dispose();
      this.log("Extension deactivated successfully");
    } catch (error) {
      this.log(`Error during deactivation: ${error}`, 'error');
    }
  }

  private getConfig(): ExtensionConfig {
    const config = vscode.workspace.getConfiguration('codeowners');
    return {
      showDebugLogs: config.get('showDebugLogs', false),
      statusBarPriority: config.get('statusBarPriority', 100),
      additionalCodeownersPaths: config.get('additionalCodeownersPaths', []),
    };
  }

  private validateWorkspace(): boolean {
    if (!vscode.workspace.workspaceFolders?.length) {
      this.log("No workspace folders found", 'warn');
      vscode.window.showWarningMessage("CODEOWNERS Status: No workspace folders found");
      return false;
    }

    const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    if (!fs.existsSync(rootPath)) {
      this.log(`Workspace root path does not exist: ${rootPath}`, 'error');
      vscode.window.showErrorMessage(`CODEOWNERS Status: Invalid workspace path: ${rootPath}`);
      return false;
    }

    return true;
  }

  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    this.outputChannel.appendLine(logMessage);
    
    // Only show debug logs if enabled
    if (this.getConfig().showDebugLogs || level === 'error' || level === 'warn') {
      this.outputChannel.show();
    }
    
    // Log errors to console for debugging
    if (level === 'error') {
      console.error(logMessage);
    } else if (level === 'warn') {
      console.warn(logMessage);
    }
  }

  private loadCodeowners(): void {
    try {
      this.rules = [];
      
      if (!this.validateWorkspace()) {
        return;
      }

      const rootPath = vscode.workspace.workspaceFolders![0].uri.fsPath;
      this.log(`Workspace root: ${rootPath}`);

      const codeownersPath = this.findCodeownersFile(rootPath);
      if (!codeownersPath) {
        this.log("No CODEOWNERS file found", 'warn');
        return;
      }

      // Check if file has actually changed
      if (!this.shouldReloadCodeowners(codeownersPath)) {
        this.log("CODEOWNERS file unchanged, skipping reload");
        return;
      }

      const fileContent = this.readCodeownersFile(codeownersPath);
      if (!fileContent) {
        return;
      }

      this.parseCodeownersContent(fileContent);
      this.lastCodeownersModified = Date.now();
      
    } catch (error) {
      this.log(`Error loading CODEOWNERS: ${error}`, 'error');
      vscode.window.showErrorMessage(`Failed to load CODEOWNERS: ${error}`);
    }
  }

  private shouldReloadCodeowners(filePath: string): boolean {
    try {
      const stats = fs.statSync(filePath);
      return stats.mtime.getTime() > this.lastCodeownersModified;
    } catch {
      return true; // Reload if we can't check the file
    }
  }

  private findCodeownersFile(rootPath: string): string | null {
    const config = this.getConfig();
    const possiblePaths = [
      path.join(rootPath, "CODEOWNERS"),
      path.join(rootPath, ".github", "CODEOWNERS"),
      ...config.additionalCodeownersPaths.map(p => path.join(rootPath, p))
    ];

    for (const p of possiblePaths) {
      if (this.isValidCodeownersFile(p)) {
        return p;
      }
    }
    return null;
  }

  private isValidCodeownersFile(filePath: string): boolean {
    try {
      if (!fs.existsSync(filePath)) {
        return false;
      }
      
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        return false;
      }
      
      // Check if file is readable
      fs.accessSync(filePath, fs.constants.R_OK);
      
      return true;
    } catch {
      return false;
    }
  }

  private readCodeownersFile(filePath: string): string | null {
    try {
      const fileContent = fs.readFileSync(filePath, "utf8");
      
      // Validate content
      if (typeof fileContent !== 'string') {
        throw new Error("File content is not a string");
      }
      
      if (fileContent.length === 0) {
        this.log("CODEOWNERS file is empty", 'warn');
        return null;
      }

      // Check for reasonable file size (prevent reading extremely large files)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (fileContent.length > maxSize) {
        throw new Error(`CODEOWNERS file too large: ${(fileContent.length / 1024 / 1024).toFixed(2)}MB`);
      }

      this.log(`Loaded CODEOWNERS from: ${filePath}`);
      this.log(`File size: ${fileContent.length} characters`);
      return fileContent;
      
    } catch (error) {
      const errorMessage = `Error reading CODEOWNERS file: ${error}`;
      this.log(errorMessage, 'error');
      vscode.window.showErrorMessage(`CODEOWNERS Status: ${errorMessage}`);
      return null;
    }
  }

  private parseCodeownersContent(content: string): void {
    try {
      if (!content || typeof content !== 'string') {
        throw new Error("Invalid content provided");
      }

      const lines = content.split("\n");
      this.log(`Total lines in CODEOWNERS: ${lines.length}`);
      
      let validRules = 0;
      let invalidLines = 0;
      
      for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
        const line = lines[lineNumber].trim();
        
        // Skip empty lines and comments
        if (!line || line.startsWith("#")) {
          continue;
        }

        try {
          const [pattern, ...owners] = line.split(/\s+/);
          
          // Validate pattern and owners
          if (!this.isValidPattern(pattern)) {
            this.log(`Invalid pattern on line ${lineNumber + 1}: "${pattern}"`, 'warn');
            invalidLines++;
            continue;
          }
          
          if (!this.isValidOwners(owners)) {
            this.log(`Invalid owners on line ${lineNumber + 1}: [${owners.join(", ")}]`, 'warn');
            invalidLines++;
            continue;
          }

          this.rules.push({ pattern, owners });
          validRules++;
        } catch (error) {
          this.log(`Error parsing line ${lineNumber + 1}: ${error}`, 'warn');
          invalidLines++;
        }
      }
      
      this.log(`Loaded ${validRules} valid rules from CODEOWNERS`);
      if (invalidLines > 0) {
        this.log(`Skipped ${invalidLines} invalid lines`, 'warn');
      }
      
    } catch (error) {
      this.log(`Error parsing CODEOWNERS content: ${error}`, 'error');
      throw error;
    }
  }

  private isValidPattern(pattern: string): boolean {
    if (!pattern || typeof pattern !== 'string') {
      return false;
    }
    
    // Pattern should not be empty after trimming
    if (pattern.trim().length === 0) {
      return false;
    }
    
    // Basic validation - pattern should contain valid characters
    if (!/^[a-zA-Z0-9\/\*\?\[\]{}!@#$%^&()_+\-=\s\.]+$/.test(pattern)) {
      return false;
    }
    
    return true;
  }

  private isValidOwners(owners: string[]): boolean {
    if (!Array.isArray(owners) || owners.length === 0) {
      return false;
    }
    
    // Each owner should be a non-empty string
    return owners.every(owner => 
      typeof owner === 'string' && 
      owner.trim().length > 0 &&
      owner.includes('@') // Basic validation that it looks like a GitHub username
    );
  }

  private isCodeownersFile(fileName: string): boolean {
    if (!fileName || typeof fileName !== 'string') {
      return false;
    }
    
    const lowerFileName = fileName.toLowerCase();
    return lowerFileName.includes("codeowners") || lowerFileName.endsWith("owners");
  }

  private findOwners(filePath: string): string[] {
    try {
      if (!this.rules.length) {
        this.log("No rules loaded, returning empty array");
        return [];
      }

      if (!filePath || typeof filePath !== 'string') {
        this.log("Invalid file path provided", 'warn');
        return [];
      }

      // Normalize path to workspace root relative
      if (!vscode.workspace.workspaceFolders?.length) {
        return [];
      }
      
      const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const relative = path.relative(root, filePath);
      
      // Validate relative path
      if (relative === '' || relative.startsWith('..')) {
        this.log(`File path outside workspace: ${filePath}`, 'warn');
        return [];
      }
      
      this.log(`Looking for owners for file: ${filePath}`);
      this.log(`Relative path: ${relative}`);
      this.log(`Total rules to check: ${this.rules.length}`);

      let matchedOwners: string[] = [];

      for (const rule of this.rules) {
        try {
          const normalizedPattern = this.normalizePattern(rule.pattern);
          const isMatch = minimatch(relative, normalizedPattern, { dot: true });
          
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
      
    } catch (error) {
      this.log(`Error finding owners: ${error}`, 'error');
      return [];
    }
  }

  private normalizePattern(pattern: string): string {
    try {
      if (!pattern || typeof pattern !== 'string') {
        throw new Error("Invalid pattern");
      }
      
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
      
    } catch (error) {
      this.log(`Error normalizing pattern "${pattern}": ${error}`, 'error');
      return pattern; // Return original pattern if normalization fails
    }
  }

  private updateStatusBar(): void {
    try {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        this.log("No active editor, hiding status bar");
        this.statusBarItem.hide();
        return;
      }

      const fileName = editor.document.fileName;
      if (!fileName) {
        this.log("Editor has no file name", 'warn');
        return;
      }

      this.log(`Updating status bar for: ${fileName}`);
      const owners = this.findOwners(fileName);
      
      if (owners.length > 0) {
        this.statusBarItem.text = `👥 Owners: ${owners.join(", ")}`;
        this.statusBarItem.show();
        this.log(`Status bar updated with owners: ${owners.join(", ")}`);
      } else {
        this.statusBarItem.text = `👥 No owners found`;
        this.statusBarItem.show();
        this.log(`Status bar updated: No owners found`);
      }
      
    } catch (error) {
      this.log(`Error updating status bar: ${error}`, 'error');
      // Show error in status bar
      this.statusBarItem.text = `👥 Error`;
      this.statusBarItem.show();
    }
  }
}

// Extension instance
let extension: CodeownersExtension;

export function activate(context: vscode.ExtensionContext): void {
  try {
    extension = new CodeownersExtension();
    extension.activate(context);
  } catch (error) {
    console.error("Failed to create extension instance:", error);
    vscode.window.showErrorMessage(`Failed to create CODEOWNERS Status extension: ${error}`);
  }
}

export function deactivate(): void {
  try {
    if (extension) {
      extension.deactivate();
    }
  } catch (error) {
    console.error("Error during extension deactivation:", error);
  }
}