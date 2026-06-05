import { AppiumDriverManager } from './appiumDriverManager';
import { BrowserWindow } from 'electron';
import { exec } from 'child_process';
import * as os from 'os';
import * as fs from 'fs';

const IGNORED_CLASSES = [
    'android.widget.FrameLayout',
    'android.widget.LinearLayout',
    'android.view.ViewGroup',
    'androidx.compose.ui.platform.ComposeView',
];

const IGNORED_IDS = [
    'android:id/content',
    'android:id/navigationBarBackground',
    'android:id/statusBarBackground',
];

export class MobileInspector {
    private lastTag: string     = 'View';
    private inspecting: boolean = false;
    private lastXml: string     = '';

    constructor(private dm: AppiumDriverManager) {}

    async activate(): Promise<void> {
        this.lastTag    = 'View';
        this.inspecting = true;
        try { this.lastXml = await this.dm.getPageSource(); } catch { this.lastXml = ''; }
        console.log('[MobileInspector] Inspector activado - toca un elemento');
    }

    async waitForSelection(timeoutSec: number): Promise<string | null> {
        const limit = Date.now() + timeoutSec * 1000;
        let initialSource = this.lastXml;

        console.log('[MobileInspector] Esperando toque...');

        while (Date.now() < limit && this.inspecting) {
            await new Promise(r => setTimeout(r, 700));
            try {
                const currentSource = await this.dm.getPageSource();
                if (currentSource !== initialSource) {
                    console.log('[MobileInspector] Cambio detectado');
                    await new Promise(r => setTimeout(r, 500));
                    let stable = currentSource;
                    try { stable = await this.dm.getPageSource(); } catch {}

                    fs.writeFileSync('/tmp/appium_source.xml', stable, 'utf-8');

                    const xpath = this.parseXPath(stable);
                    console.log('[MobileInspector] XPath:', xpath);

                    if (xpath) {
                        this.inspecting = false;
                        return xpath;
                    }
                    initialSource = stable;
                }
            } catch (e: any) {
                console.warn('[MobileInspector]:', e.message?.slice(0, 80));
                await new Promise(r => setTimeout(r, 1000));
                try { initialSource = await this.dm.getPageSource(); } catch {}
            }
        }

        try {
            const source = await this.dm.getPageSource();
            const xpath  = this.parseXPath(source);
            this.inspecting = false;
            return xpath;
        } catch {
            this.inspecting = false;
            return null;
        }
    }

    private parseXPath(xml: string): string | null {
        // El XML usa tags con nombres de clase: <android.widget.Button .../>
        // Extraer todos los tags de elemento con sus atributos
        const tagRegex = /<(android\.[a-zA-Z.]+|androidx\.[a-zA-Z.]+|[a-zA-Z]+\.[a-zA-Z.]+)\s([^>]*?)(?:\/?>)/g;
        const candidates: Array<{score: number, xpath: string}> = [];

        let match;
        while ((match = tagRegex.exec(xml)) !== null) {
            const tagName  = match[1];
            const attribs  = match[2];

            const getA = (attr: string) => {
                const m = attribs.match(new RegExp(`\\b${attr}="([^"]*)"`));
                return m ? m[1] : '';
            };

            const resourceId  = getA('resource-id');
            const text        = getA('text');
            const contentDesc = getA('content-desc');
            const clickable   = getA('clickable');
            const focusable   = getA('focusable');
            const focused     = getA('focused');
            const selected    = getA('selected');
            const displayed   = getA('displayed');
            const enabled     = getA('enabled');

            if (displayed === 'false') continue;
            if (IGNORED_IDS.includes(resourceId)) continue;
            if (IGNORED_CLASSES.includes(tagName) && !resourceId && !text && !contentDesc) continue;

            let score = 0;
            if (focused   === 'true') score += 10;
            if (selected  === 'true') score += 8;
            if (clickable === 'true') score += 6;
            if (focusable === 'true') score += 3;
            if (enabled   === 'true') score += 1;
            if (resourceId && !IGNORED_IDS.includes(resourceId)) score += 7;
            if (text && text.length > 0 && text.length < 80)     score += 5;
            if (contentDesc && contentDesc.length > 0)           score += 4;

            if (score < 5) continue;

            // Construir XPath
            this.lastTag = tagName.split('.').pop() || 'View';
            let xpath = '';
            if (resourceId && !IGNORED_IDS.includes(resourceId))
                xpath = `//*[@resource-id="${resourceId}"]`;
            else if (contentDesc && contentDesc.length < 80)
                xpath = `//*[@content-desc="${contentDesc}"]`;
            else if (text && text.length > 0 && text.length < 80)
                xpath = `//*[@text="${text}"]`;
            else if (tagName)
                xpath = `//${tagName}`;

            if (xpath) candidates.push({ score, xpath });
        }

        candidates.sort((a, b) => b.score - a.score);

        console.log('[MobileInspector] Candidatos top 3:',
            candidates.slice(0, 3).map(c => `score=${c.score} → ${c.xpath}`)
        );

        return candidates.length > 0 ? candidates[0].xpath : null;
    }

    buildXPathFromNode(node: string): string {
        return '';
    }

    async captureScreenshot(): Promise<string> {
        return `data:image/png;base64,${await this.dm.takeScreenshot()}`;
    }

    getLastTag(): string { return this.lastTag; }
    cancel(): void { this.inspecting = false; }

    suggestVariableName(xpath: string, tag: string): string {
        const patterns = [
            /@resource-id="[^"]*\/([^"]+)"/,
            /@resource-id="([^"]+)"/,
            /@content-desc="([^"]+)"/,
            /@text="([^"]+)"/,
        ];
        for (const re of patterns) {
            const m = xpath.match(re);
            if (m) {
                const name = m[1].toLowerCase()
                    .replace(/[^a-z0-9]/g, '_')
                    .replace(/_+/g, '_')
                    .replace(/^_|_$/g, '');
                return `${tag.toLowerCase()}_${name}`;
            }
        }
        return `${tag.toLowerCase()}_${Date.now() % 1000}`;
    }

    async bringPanelToFront(win: BrowserWindow | null): Promise<void> {
        try {
            if (os.platform() === 'darwin') {
                exec('osascript -e \'tell application "System Events" to set frontmost of (first process whose name contains "Electron") to true\'');
                await new Promise(r => setTimeout(r, 300));
            }
            win?.focus();
        } catch {}
    }
}
