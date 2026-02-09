import path from "path";
import fs from "fs";
import Database from "better-sqlite3";

export default function loadVecExtension(db: Database.Database) : void  {
  if (!db) throw new Error("DB not initialized");

  const platform = process.platform;
  const arch = process.arch;

  let extensionPath: string | null = null;

  const basePath = path.join(
    process.cwd(),
    'node_modules'
  );

//   console.log(`Loading sqlite-vec extension for platform: ${platform}, architecture: ${arch}`);

//   //log basePath
//     console.log(`Base path for sqlite-vec: ${basePath}`);

  if (platform === 'win32' && arch === 'x64') {
    extensionPath = path.join(
      basePath,
      'sqlite-vec-windows-x64',
      'vec0.dll'
    );
  } else if (platform === 'linux' && arch === 'x64') {
    extensionPath = path.join(
      basePath,
      'sqlite-vec-linux-x64',
      'vec0.so'
    );
  } else if (platform === 'darwin' && arch === 'x64') {
    extensionPath = path.join(
      basePath,
      'sqlite-vec-darwin-x64',
      'vec0.dylib'
    );
  } else if (platform === 'darwin' && arch === 'arm64') {
    extensionPath = path.join(
      basePath,
      'sqlite-vec-darwin-arm64',
      'vec0.dylib'
    );
  }

  if (!extensionPath || !fs.existsSync(extensionPath)) {
    throw new Error(
      `Unsupported platform or sqlite-vec binary not found for ${platform}-${arch}`
    );
  }

  db.loadExtension(extensionPath);
}
