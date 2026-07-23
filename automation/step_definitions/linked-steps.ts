// Generado por Appium Visual Recorder — 23/6/2026, 10:18:34
import { Given } from '@cucumber/cucumber';
import { PageFactory } from '../pageFactory';

Given('el usuario se logea en el artefacto de QA', async () => {
    await PageFactory.base.click('nueve');
    await PageFactory.base.click('nueve');
    await PageFactory.base.click('nueve');
    await PageFactory.base.click('nueve');
});

Given('el usuario se logeo', async () => {
    await PageFactory.login.click('nueve');
    await PageFactory.base.click('nueve');
});

Given('clic en mostrar saldo', async () => {
    await PageFactory.base.click('mostrar_saldo');
});
