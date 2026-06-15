import { BasePage } from './commons/BasePage';

/**
 * HomePage — flujos y reglas de negocio del home principal.
 *
 * Locators requeridos en recorded.locators:
 *   home_saldo          → texto/área del saldo visible
 *   mostrar_saldo       → botón para revelar el saldo
 *   ocultar_saldo       → botón para ocultar el saldo
 *   entendido           → botón "ENTENDIDO" / "Entendido" en modales
 *   permitir            → botón "Permitir" en diálogos de permisos
 *   modal_novedades     → modal de novedades / actualizaciones (si existe)
 *   nav_yapear          → tab / botón de acción principal "Yapear"
 *   nav_ver_todo        → enlace "Ver todo" en actividad reciente
 *   nav_retiro          → opción "Giro/retiro de efectivo"
 */
export class HomePage extends BasePage {

    // ── Estado inicial ───────────────────────────────────────────────────────

    /**
     * Espera a que el home cargue completamente después del login.
     * Regla de negocio: tras el login pueden aparecer modales de novedades
     * o solicitudes de permisos que hay que cerrar antes de continuar.
     */
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

    /**
     * Cierra cualquier modal superpuesto al home (novedades, permisos).
     * Se puede llamar varias veces de forma segura.
     */
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

    // ── Saldo ────────────────────────────────────────────────────────────────

    /** Revela el saldo si está oculto. */
    async showBalance(): Promise<void> {
        if (await this.isVisible('mostrar_saldo')) {
            await this.click('mostrar_saldo');
        }
    }

    /** Oculta el saldo si está visible. */
    async hideBalance(): Promise<void> {
        if (await this.isVisible('ocultar_saldo')) {
            await this.click('ocultar_saldo');
        }
    }

    /**
     * Verifica que el saldo mostrado contenga el texto esperado.
     * Pasa undefined para solo verificar que el área de saldo existe.
     */
    async verifyBalance(expected?: string): Promise<void> {
        await this.waitFor('home_saldo');
        if (expected !== undefined) {
            await this.verifyText('home_saldo', expected);
        }
    }

    // ── Navegación ───────────────────────────────────────────────────────────

    /**
     * Navega a una sección del home por nombre lógico.
     * Regla: centraliza los puntos de entrada para que el test
     * no dependa de qué tab o ícono exacto disparar.
     */
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

    /** Verifica que el home sea visible (el usuario está logueado). */
    async isLoggedIn(): Promise<boolean> {
        return this.isVisible('home_saldo');
    }
}
