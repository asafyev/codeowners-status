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
    return;
  }
  const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

  // Common CODEOWNERS locations
  const possiblePaths = [
    path.join(rootPath, "CODEOWNERS"),
    path.join(rootPath, ".github", "CODEOWNERS"),
  ];

  let fileContent: string | null = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      fileContent = fs.readFileSync(p, "utf8");
      break;
    }
  }

  if (!fileContent) {
    return;
  }

  const lines = fileContent.split("\n");
  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith("#")) continue;

    const [pattern, ...owners] = line.split(/\s+/);
    if (!pattern || owners.length === 0) continue;

    rules.push({ pattern, owners });
  }
}

function findOwners(filePath: string): string[] {
  if (!rules.length) return [];

  // Normalize path to workspace root relative
  if (!vscode.workspace.workspaceFolders) return [];
  const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
  const relative = path.relative(root, filePath);

  let matchedOwners: string[] = [];

  for (const rule of rules) {
    if (minimatch(relative, rule.pattern, { dot: true })) {
      matchedOwners = rule.owners;
    }
  }

  return matchedOwners;
}

function updateStatusBar() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    statusBarItem.hide();
    return;
  }

  const owners = findOwners(editor.document.fileName);
  if (owners.length > 0) {
    statusBarItem.text = `👥 Owners: ${owners.join(", ")}`;
    statusBarItem.show();
  } else {
    statusBarItem.text = `👥 No owners found`;
    statusBarItem.show();
  }
}

export function deactivate() {}
