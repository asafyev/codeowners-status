import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import minimatch from "minimatch";

interface Rule {
  pattern: string;
  owners: string[];
}

let rules: Rule[] = [];
let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  try {
    // Fallback logging to console
    console.log("CODEOWNERS Status extension starting...");
    
    // Create output channel for logging
    outputChannel = vscode.window.createOutputChannel("CODEOWNERS Status");
    outputChannel.show();
    outputChannel.appendLine("CODEOWNERS Status extension activated");

    statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    context.subscriptions.push(statusBarItem);

    // Load CODEOWNERS at startup
    loadCodeowners();

    // Update when active editor changes
    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(() => updateStatusBar())
    );

    // Update when files change
    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument((doc) => {
        if (doc.fileName.toLowerCase().includes("codeowners")) {
          loadCodeowners();
          updateStatusBar();
        }
      })
    );

    updateStatusBar();
    
    console.log("CODEOWNERS Status extension activated successfully");
  } catch (error) {
    console.error("Error activating CODEOWNERS Status extension:", error);
    if (outputChannel) {
      outputChannel.appendLine(`Error activating CODEOWNERS Status extension: ${error}`);
    }
  }
}

function log(message: string) {
  outputChannel.appendLine(`[${new Date().toISOString()}] ${message}`);
}

function loadCodeowners() {
  rules = [];
  if (!vscode.workspace.workspaceFolders) {
    log("No workspace folders found");
    return;
  }
  const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
  log(`Workspace root: ${rootPath}`);

  // Common CODEOWNERS locations
  const possiblePaths = [
    path.join(rootPath, "CODEOWNERS"),
    path.join(rootPath, ".github", "CODEOWNERS"),
  ];

  let fileContent: string | null = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        fileContent = fs.readFileSync(p, "utf8");
        log(`Loaded CODEOWNERS from: ${p}`);
        log(`File size: ${fileContent.length} characters`);
        break;
      } catch (error) {
        log(`Error reading CODEOWNERS file: ${error}`);
      }
    }
  }

  if (!fileContent) {
    log(`No CODEOWNERS file found in: ${possiblePaths.join(", ")}`);
    return;
  }

  const lines = fileContent.split("\n");
  log(`Total lines in CODEOWNERS: ${lines.length}`);
  
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

    rules.push({ pattern, owners });
    validRules++;
    
    // Log first few rules to verify parsing
    if (validRules <= 5) {
      log(`Rule ${validRules}: pattern="${pattern}", owners=[${owners.join(", ")}]`);
    }
  }
  
  log(`Loaded ${rules.length} valid rules from CODEOWNERS`);
}

function findOwners(filePath: string): string[] {
  if (!rules.length) {
    log("No rules loaded, returning empty array");
    return [];
  }

  // Normalize path to workspace root relative
  if (!vscode.workspace.workspaceFolders) {
    return [];
  }
  const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
  const relative = path.relative(root, filePath);
  
  log(`Looking for owners for file: ${filePath}`);
  log(`Relative path: ${relative}`);
  log(`Total rules to check: ${rules.length}`);

  let matchedOwners: string[] = [];

  for (const rule of rules) {
    try {
      const isMatch = minimatch(relative, normalizePattern(rule.pattern), { dot: true });
      if (isMatch) {
        log(`Pattern "${rule.pattern}" matched for "${relative}"`);
        matchedOwners = rule.owners;
      }
    } catch (error) {
      log(`Error matching pattern "${rule.pattern}": ${error}`);
    }
  }

  log(`Final matched owners: ${matchedOwners.join(", ")}`);
  return matchedOwners;
}

function normalizePattern(pattern: string): string {
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

function updateStatusBar() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    log("No active editor, hiding status bar");
    statusBarItem.hide();
    return;
  }

  log(`Updating status bar for: ${editor.document.fileName}`);
  const owners = findOwners(editor.document.fileName);
  
  if (owners.length > 0) {
    statusBarItem.text = `👥 Owners: ${owners.join(", ")}`;
    statusBarItem.show();
    log(`Status bar updated with owners: ${owners.join(", ")}`);
  } else {
    statusBarItem.text = `👥 No owners found`;
    statusBarItem.show();
    log(`Status bar updated: No owners found`);
  }
}

export function deactivate() {
  if (outputChannel) {
    outputChannel.dispose();
  }
}