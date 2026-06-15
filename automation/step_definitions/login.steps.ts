import { Given, When, Then, Before, After, setDefaultTimeout } from '@cucumber/cucumber';
import { AppiumDriverManager } from '../../core/appiumDriverManager';
import { LocatorManager } from '../../core/locatorManager';
import { MobileStepExecutor } from '../../core/mobileStepExecutor';
import { PageFactory } from '../pageFactory';
import assert from 'assert';

setDefaultTimeout(60 * 1000);

const dm = new AppiumDriverManager();
const lm = new LocatorManager('./resources/locators/recorded.locators');
let executor: MobileStepExecutor;

Before(async () => {
    await dm.init({
        deviceName:      'SM-A566E',
        udid:            'R5GL34VQKAX',
        platformVersion: '16',
        appPackage:      process.env.APP_PACKAGE || 'com.yape.qa',
        appActivity:     process.env.APP_ACTIVITY || '.MainActivity',
    });
    executor = new MobileStepExecutor(dm, lm);
    PageFactory.init(dm, executor, lm);
});

After(async () => {
    await dm.quit();
});


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
