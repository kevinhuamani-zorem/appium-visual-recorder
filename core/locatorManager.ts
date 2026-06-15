import * as fs from 'fs';
import * as path from 'path';

const SEP = ':@:';

export class LocatorManager {
    private locators: Map<string, string> = new Map();

    constructor(private filePath: string) {
        this.load();
    }

    private load(): void {
        if (!fs.existsSync(this.filePath)) return;
        const lines = fs.readFileSync(this.filePath, 'utf-8').split('\n');
        for (const line of lines) {
            if (line.startsWith('#') || !line.trim()) continue;
            const [key, ...rest] = line.split(SEP);
            if (key && rest.length) {
                this.locators.set(key.trim(), rest.join(SEP).trim());
            }
        }
        console.log(`[LocatorManager] Cargados ${this.locators.size} locators`);
    }

    private save(): void {
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const lines = [
            '# Archivo generado por Appium Visual Recorder',
            '# formato: nombre_variable:@:selector',
            '# Selectores soportados:',
            '#   XPath    : //android.widget.Button[@text="Login"]',
            '#   Resource : //*[@resource-id="com.app:id/btn_login"]',
            '#   AccId    : ~accessibility_id',
            '',
            ...Array.from(this.locators.entries()).map(([k, v]) => `${k}${SEP}${v}`)
        ];
        fs.writeFileSync(this.filePath, lines.join('\n'), 'utf-8');
    }

    add(name: string, selector: string): void {
        this.locators.set(name, selector);
        this.save();
        console.log(`[LocatorManager] Guardado: ${name}${SEP}${selector}`);
    }

    resolve(variable: string): string {
        const key = variable.replace(/[{}]/g, '');
        return this.locators.get(key) || variable;
    }

    exists(name: string): boolean {
        return this.locators.has(name);
    }

    getAll(): Record<string, string> {
        return Object.fromEntries(this.locators);
    }

    getFilePath(): string {
        return this.filePath;
    }
}
