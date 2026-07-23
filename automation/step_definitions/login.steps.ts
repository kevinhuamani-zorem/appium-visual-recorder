import { Given, When, Then } from '@cucumber/cucumber';
import { PageFactory } from '../pageFactory';
import assert from 'assert';

// El Before/After y la inicialización del driver viven en steps.ts

Given('el usuario está en la pantalla de login', async () => {
    await PageFactory.login.navigateToPin();
});

When('el usuario hace login con el PIN {string}', async (pin: string) => {
    await PageFactory.login.loginWithPin(pin);
});

When('el usuario hace login completo con PIN {string}', async (pin: string) => {
    await PageFactory.login.login(pin);
    await PageFactory.home.waitForHome();
});

When('el usuario cancela la biometría', async () => {
    await PageFactory.login.dismissBiometricsIfPresent();
});


Then('el login debería ser exitoso', async () => {
    await PageFactory.home.waitForHome();
    const loggedIn = await PageFactory.home.isLoggedIn();
    assert.ok(loggedIn, 'Se esperaba que el usuario estuviera en el home tras el login');
});

Then('debería aparecer un error de PIN incorrecto', async () => {
    const hasError = await PageFactory.login.hasLoginError();
    assert.ok(hasError, 'Se esperaba un mensaje de error de PIN incorrecto');
});

Then('el mensaje de error debería contener {string}', async (expectedText: string) => {
    await PageFactory.login.verifyLoginError(expectedText);
});

Then('el usuario debería estar en el home', async () => {
    await PageFactory.home.waitForHome();
    const loggedIn = await PageFactory.home.isLoggedIn();
    assert.ok(loggedIn, 'Se esperaba que el usuario estuviera en el home');
});
