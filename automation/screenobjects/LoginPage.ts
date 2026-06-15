import { BasePage } from './commons/BasePage';

/**
 * LoginPage — flujos y reglas de negocio de la pantalla de login.
 *
 * Locators requeridos en recorded.locators:
 *   mostrar_saldo       → botón "Mostrar saldo" / entrada al login
 *   iniciar_sesion      → botón "Iniciar sesión"
 *   cancelar_biometria  → botón para cancelar huella/face ID (opcional)
 *   btn_0 … btn_9       → teclas del teclado numérico de PIN
 *   campo_pin           → campo del PIN (alternativa al teclado numérico)
 *   error_pin           → mensaje de error de PIN incorrecto
 *   intentarlo_despues  → enlace "Intentarlo después" en biometría
 */
export class LoginPage extends BasePage {

    // ── Flujos principales ───────────────────────────────────────────────────

    /**
     * Hace login completo: cancela biometría si aparece, digita el PIN
     * dígito por dígito usando los botones del teclado numérico grabado.
     *
     * Regla de negocio: el teclado de PIN es nativo (no un input),
     * por lo que se presiona cada tecla individualmente.
     */
    async loginWithPin(pin: string): Promise<void> {
        await this.dismissBiometricsIfPresent();
        for (const digit of pin) {
            await this.click(`btn_${digit}`);
        }
    }

    /**
     * Navega desde la pantalla inicial hasta la pantalla de PIN.
     * Regla: el flujo puede arrancar con "Mostrar saldo" o directamente
     * con "Iniciar sesión" dependiendo del estado previo de la sesión.
     */
    async navigateToPin(): Promise<void> {
        const first = await this.waitForAny(['mostrar_saldo', 'iniciar_sesion'], 10_000);
        if (first === 'mostrar_saldo') {
            await this.click('mostrar_saldo');
            await this.waitFor('iniciar_sesion');
        }
        await this.click('iniciar_sesion');
    }

    /**
     * Flujo completo de login: navega a PIN + introduce el PIN.
     */
    async login(pin: string): Promise<void> {
        await this.navigateToPin();
        await this.loginWithPin(pin);
    }

    // ── Verificaciones ───────────────────────────────────────────────────────

    /**
     * Devuelve true si hay un mensaje de error de PIN visible.
     */
    async hasLoginError(): Promise<boolean> {
        return this.isVisible('error_pin');
    }

    /**
     * Verifica que el mensaje de error de PIN sea el esperado.
     */
    async verifyLoginError(expectedText: string): Promise<void> {
        await this.verifyText('error_pin', expectedText);
    }

    // ── Acciones auxiliares ──────────────────────────────────────────────────

    /**
     * Si la pantalla de biometría está activa, la cancela usando
     * "Intentarlo después". No falla si la biometría no aparece.
     */
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
