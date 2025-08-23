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

export function activate(context: vscode.ExtensionContext) {
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
}

function loadCodeowners() {
  rules = [];
  if (!vscode.workspace.workspaceFolders) {
    console.log("No workspace folders found");
    return;
  }
  const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
  console.log("Workspace root:", rootPath);

  // Common CODEOWNERS locations
  const possiblePaths = [
    path.join(rootPath, "CODEOWNERS"),
    path.join(rootPath, ".github", "CODEOWNERS"),
  ];

  let fileContent: string | null = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      fileContent = fs.readFileSync(p, "utf8");
      console.log(`Loaded CODEOWNERS from: ${p}`);
      console.log(`File size: ${fileContent.length} characters`);
      break;
    }
  }

  if (!fileContent) {
    console.log("No CODEOWNERS file found in:", possiblePaths);
    return;
  }

  const lines = fileContent.split("\n");
  console.log(`Total lines in CODEOWNERS: ${lines.length}`);
  
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
      console.log(`Rule ${validRules}: pattern="${pattern}", owners=[${owners.join(", ")}]`);
    }
  }
  
  console.log(`Loaded ${rules.length} valid rules from CODEOWNERS`);
}

function findOwners(filePath: string): string[] {
  if (!rules.length) {
    console.log("No rules loaded, returning empty array");
    return [];
  }

  // Normalize path to workspace root relative
  if (!vscode.workspace.workspaceFolders) {
    return [];
  }
  const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
  const relative = path.relative(root, filePath);
  
  console.log(`Looking for owners for file: ${filePath}`);
  console.log(`Relative path: ${relative}`);
  console.log(`Total rules to check: ${rules.length}`);

  let matchedOwners: string[] = [];

  for (const rule of rules) {
    const isMatch = minimatch(relative, rule.pattern, { dot: true });
    if (isMatch) {
      console.log(`Pattern "${rule.pattern}" matched for "${relative}"`);
      matchedOwners = rule.owners;
    }
  }

  console.log(`Final matched owners:`, matchedOwners);
  return matchedOwners;
}

function updateStatusBar() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    console.log("No active editor, hiding status bar");
    statusBarItem.hide();
    return;
  }

  console.log(`Updating status bar for: ${editor.document.fileName}`);
  const owners = findOwners(editor.document.fileName);
  
  if (owners.length > 0) {
    statusBarItem.text = `👥 Owners: ${owners.join(", ")}`;
    statusBarItem.show();
    console.log(`Status bar updated with owners: ${owners.join(", ")}`);
  } else {
    statusBarItem.text = `👥 No owners found`;
    statusBarItem.show();
    console.log(`Status bar updated: No owners found`);
  }
}

export function deactivate() {}