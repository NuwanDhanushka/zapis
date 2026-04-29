import path from "node:path";

export interface AppPaths {
  userDataPath: string;
  exportsPath: string;
}

export function createAppPaths(appDataPath: string, documentsPath: string): AppPaths {
  return {
    userDataPath: path.join(appDataPath, "Zapis"),
    exportsPath: path.join(documentsPath, "Zapis", "exports")
  };
}
