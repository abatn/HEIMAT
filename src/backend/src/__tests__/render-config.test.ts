import fs from 'fs';
import path from 'path';

describe('Render deployment contract', () => {
  it('configures Render to probe the existing read-only health endpoint', () => {
    const renderPath = path.resolve(__dirname, '../../../..', 'render.yaml');
    const renderConfig = fs.readFileSync(renderPath, 'utf8');
    const backendBlock = renderConfig.match(
      /(?:^|\n)\s*-\s*type:\s*web[\s\S]*?(?=\n\s*-\s*type:|\n\s*databases:|$)/,
    )?.[0];

    expect(backendBlock).toBeDefined();
    expect(backendBlock).toMatch(/^\s*-\s*type:\s*web\s*$/m);
    expect(backendBlock).toMatch(/^\s+name:\s*heimat-backend\s*$/m);
    expect(backendBlock).toMatch(/^\s+healthCheckPath:\s*\/health\s*$/m);
  });

  it('keeps the migration startup contract explicit', () => {
    const renderPath = path.resolve(__dirname, '../../../..', 'render.yaml');
    const backendPath = path.resolve(__dirname, '..', 'index.ts');
    const renderConfig = fs.readFileSync(renderPath, 'utf8');
    const backendSource = fs.readFileSync(backendPath, 'utf8');
    const backendBlock = renderConfig.match(
      /(?:^|\n)\s*-\s*type:\s*web[\s\S]*?(?=\n\s*-\s*type:|\n\s*databases:|$)/,
    )?.[0];

    expect(backendBlock).toBeDefined();
    expect(backendBlock).toMatch(/^\s+startCommand:\s*cd src\/backend && node dist\/index\.js\s*$/m);
    expect(backendBlock).not.toMatch(/^\s*-\s*key:\s*AUTO_MIGRATE\s*$/m);
    expect(backendSource).toContain("process.env.AUTO_MIGRATE !== 'false'");
    expect(backendSource).toContain("execSync('node dist/scripts/migrate.js'");
  });
});
