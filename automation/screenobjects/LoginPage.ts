import { BasePage } from './commons/BasePage';

/**
 * LoginPage — flujos y reglas de negocio de la pantalla de login.
 */
export class LoginPage extends BasePage {

    // ── Flujos principales ───────────────────────────────────────────────────
    async loginWithPin(pin: string): Promise<void> {
        await this.dismissBiometricsIfPresent();
        for (const digit of pin) {
            await this.click(`btn_${digit}`);
        }
    }

    async navigateToPin(): Promise<void> {
        const first = await this.waitForAny(['mostrar_saldo', 'iniciar_sesion'], 10_000);
        if (first === 'mostrar_saldo') {
            await this.click('mostrar_saldo');
            await this.waitFor('iniciar_sesion');
        }
        await this.click('iniciar_sesion');
    }

    async login(pin: string): Promise<void> {
        await this.navigateToPin();
        await this.loginWithPin(pin);
    }

    // ── Verificaciones ───────────────────────────────────────────────────────
    async hasLoginError(): Promise<boolean> {
        return this.isVisible('error_pin');
    }

    async verifyLoginError(expectedText: string): Promise<void> {
        await this.verifyText('error_pin', expectedText);
    }

    // ── Acciones auxiliares ──────────────────────────────────────────────────

    async dismissBiometricsIfPresent(): Promise<void> {
        if (await this.isVisible('cancelar_biometria')) {
            await this.click('cancelar_biometria');
            return;
        }
        if (await this.isVisible('intentarlo_despues')) {
            await this.click('intentarlo_despues');
        }
    }
}
