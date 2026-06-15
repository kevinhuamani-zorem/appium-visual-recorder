import { AppiumDriverManager } from '../../core/appiumDriverManager';
import { BrowserWindow } from 'electron';
import { exec } from 'child_process';
import * as os from 'os';
import * as fs from 'fs';

export interface SelectorCandidate {
    label:    string;   // 'resource-id' | 'resource-id contains' | 'content-desc' | 'text' | 'text contains' | 'xpath'
    selector: string;   // XPath completo listo para usar
    priority: number;   // 1 = más estable
}

export interface InspectorResult {
    candidates: SelectorCandidate[];
    suggested:  string;   // nombre de variable sugerido basado en el candidato P1
    tag:        string;   // clase corta del elemento (Button, TextView…)
}

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

    async waitForSelection(timeoutSec: number): Promise<InspectorResult | null> {
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

                    const result = this.buildCandidates(stable);
                    console.log('[MobileInspector] Candidatos:', result?.candidates.map(c => `P${c.priority} ${c.label}: ${c.selector}`));

                    if (result) {
                        this.inspecting = false;
                        return result;
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
            const result = this.buildCandidates(source);
            this.inspecting = false;
            return result;
        } catch {
            this.inspecting = false;
            return null;
        }
    }

    /**
     * Analiza el XML de la pantalla y construye todos los identificadores
     * posibles para el elemento más relevante, ordenados por prioridad:
     *   P1 resource-id exacto  → más estable
     *   P2 resource-id contains → flexible ante cambios de package
     *   P3 content-desc        → accesibilidad
     *   P4 text exacto         → texto visible
     *   P5 text contains       → texto parcial
     *   P6 XPath de clase      → fallback estructural
     */
    private buildCandidates(xml: string): InspectorResult | null {
        const tagRegex = /<(android\.[a-zA-Z.]+|androidx\.[a-zA-Z.]+|[a-zA-Z]+\.[a-zA-Z.]+)\s([^>]*?)(?:\/?>)/g;

        interface RawElement {
            score:       number;
            tagName:     string;
            resourceId:  string;
            contentDesc: string;
            text:        string;
        }

        const elements: RawElement[] = [];
        let match;

        while ((match = tagRegex.exec(xml)) !== null) {
            const tagName = match[1];
            const attribs = match[2];

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
            if (text && text.length > 0 && text.length < 80)      score += 5;
            if (contentDesc && contentDesc.length > 0)            score += 4;

            if (score < 5) continue;

            elements.push({ score, tagName, resourceId, contentDesc, text });
        }

        if (elements.length === 0) return null;

        // Elemento con mayor score = el que el usuario tocó
        elements.sort((a, b) => b.score - a.score);
        const el = elements[0];

        this.lastTag = el.tagName.split('.').pop() || 'View';

        const candidates: SelectorCandidate[] = [];

        // P1 — resource-id exacto (más estable)
        if (el.resourceId && !IGNORED_IDS.includes(el.resourceId)) {
            candidates.push({
                label:    'resource-id',
                selector: `//*[@resource-id="${el.resourceId}"]`,
                priority: 1,
            });

            // P2 — resource-id contains (solo la parte tras la "/")
            const idPart = el.resourceId.split('/')[1];
            if (idPart) {
                candidates.push({
                    label:    'resource-id contains',
                    selector: `//*[contains(@resource-id,"${idPart}")]`,
                    priority: 2,
                });
            }
        }

        // P3 — content-desc
        if (el.contentDesc && el.contentDesc.length > 0 && el.contentDesc.length < 80) {
            candidates.push({
                label:    'content-desc',
                selector: `//*[@content-desc="${el.contentDesc}"]`,
                priority: 3,
            });
        }

        // P4 — text exacto
        if (el.text && el.text.length > 0 && el.text.length < 80) {
            candidates.push({
                label:    'text',
                selector: `//*[@text="${el.text}"]`,
                priority: 4,
            });

            // P5 — text contains (solo si el texto es largo)
            if (el.text.length > 10) {
                candidates.push({
                    label:    'text contains',
                    selector: `//*[contains(@text,"${el.text.slice(0, 20)}")]`,
                    priority: 5,
                });
            }
        }

        // P6 — XPath de clase (fallback)
        candidates.push({
            label:    'xpath',
            selector: `//${el.tagName}`,
            priority: 6,
        });

        // Nombre de variable sugerido desde el candidato de mayor prioridad
        const suggested = this.suggestVariableName(candidates[0].selector, this.lastTag);

        return { candidates, suggested, tag: this.lastTag };
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
