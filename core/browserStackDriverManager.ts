import { remote } from 'webdriverio';
import { AppiumDriverManager } from './appiumDriverManager';

export interface BrowserStackConfig {
    username:        string;
    accessKey:       string;
    deviceName:      string;
    platformVersion: string;
    /** URL bs://... obtenida al subir el APK a BrowserStack, o vacía para usar package/activity */
    appUrl:          string;
    appPackage:      string;
    appActivity:     string;
    projectName?:    string;
    buildName?:      string;
}

/**
 * BrowserStackDriverManager — extiende AppiumDriverManager y reemplaza init()
 * para conectar al hub de BrowserStack en vez de Appium local.
 *
 * No requiere startAppiumServer() — la conexión es directamente al hub en la nube.
 */
export class BrowserStackDriverManager extends AppiumDriverManager {

    private bsConfig: BrowserStackConfig | null = null;

    /** Conecta al hub de BrowserStack. No llamar a startAppiumServer() antes. */
    async init(bsConfig: BrowserStackConfig | any): Promise<void> {
        this.bsConfig = bsConfig as BrowserStackConfig;
        console.log('[BrowserStackDriverManager] Conectando a BS hub:', bsConfig.deviceName);

        const capabilities: any = {
            platformName:                'Android',
            'appium:deviceName':         bsConfig.deviceName,
            'appium:platformVersion':    bsConfig.platformVersion,
            'appium:automationName':     'UiAutomator2',
            'appium:noReset':            true,
            'appium:newCommandTimeout':  300,
            'bstack:options': {
                userName:    bsConfig.username,
                accessKey:   bsConfig.accessKey,
                projectName: bsConfig.projectName || 'Appium Visual Recorder',
                buildName:   bsConfig.buildName   || 'recorder-' + new Date().toISOString().slice(0, 10),
                sessionName: 'recording-' + Date.now(),
                debug:       true,
            }
        };

        // App: si hay URL bs:// la usamos; si no, lanzamos por package/activity
        if (bsConfig.appUrl && bsConfig.appUrl.trim()) {
            capabilities['appium:app'] = bsConfig.appUrl.trim();
        } else {
            capabilities['appium:appPackage']  = bsConfig.appPackage;
            capabilities['appium:appActivity'] = bsConfig.appActivity;
        }

        this.driver = await remote({
            protocol:               'https',
            hostname:               'hub-cloud.browserstack.com',
            port:                   443,
            path:                   '/wd/hub',
            capabilities,
            logLevel:               'error',
            connectionRetryCount:   3,
            connectionRetryTimeout: 90000,
        });

        console.log('[BrowserStackDriverManager] Conectado al hub de BrowserStack');
    }

    getBsConfig(): BrowserStackConfig | null { return this.bsConfig; }
}
