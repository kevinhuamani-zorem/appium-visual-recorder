import { BasePage } from './commons/BasePage';

/**
 * HomePage — flujos y reglas de negocio del home principal.
 */
export class HomePage extends BasePage {

    // ── Estado inicial ───────────────────────────────────────────────────────
    async waitForHome(timeoutMs = 25_000): Promise<void> {
        const appeared = await this.waitForAny(
            ['home_saldo', 'modal_novedades', 'permitir'],
            timeoutMs
        );
        await this.dismissModals();
        // Si el home_saldo aún no está, esperamos un segundo intento
        if (appeared !== 'home_saldo') {
            await this.waitFor('home_saldo', 10_000);
        }
    }

    async dismissModals(): Promise<void> {
        if (await this.isVisible('entendido')) {
            await this.click('entendido');
        }
        if (await this.isVisible('permitir')) {
            await this.click('permitir');
        }
        if (await this.isVisible('modal_novedades')) {
            await this.click('entendido');
        }
    }

    async showBalance(): Promise<void> {
        if (await this.isVisible('mostrar_saldo')) {
            await this.click('mostrar_saldo');
        }
    }

    async hideBalance(): Promise<void> {
        if (await this.isVisible('ocultar_saldo')) {
            await this.click('ocultar_saldo');
        }
    }

    async verifyBalance(expected?: string): Promise<void> {
        await this.waitFor('home_saldo');
        if (expected !== undefined) {
            await this.verifyText('home_saldo', expected);
        }
    }

    async navigateTo(section: 'yapear' | 'ver_todo' | 'retiro'): Promise<void> {
        const locatorMap: Record<string, string> = {
            yapear:   'nav_yapear',
            ver_todo: 'nav_ver_todo',
            retiro:   'nav_retiro',
        };
        const locatorName = locatorMap[section];
        if (!locatorName) throw new Error(`[HomePage] Sección desconocida: "${section}"`);
        await this.click(locatorName);
    }

    async isLoggedIn(): Promise<boolean> {
        return this.isVisible('home_saldo');
    }
}
