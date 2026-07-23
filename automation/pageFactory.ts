import { AppiumDriverManager } from '../core/appiumDriverManager';
import { LocatorManager } from '../core/locatorManager';
import { MobileStepExecutor } from '../core/mobileStepExecutor';
import { BasePage } from './screenobjects/commons/BasePage';
import { LoginPage } from './screenobjects/LoginPage';
import { HomePage } from './screenobjects/HomePage';

/**
 * PageFactory — crea y cachea instancias de Page Objects.
 *
 * Uso en los step files:
 *
 *   Before(async () => {
 *     await dm.init({ ... });
 *     executor = new MobileStepExecutor(dm, lm);
 *     PageFactory.init(dm, executor, lm);
 *   });
 *
 *   // En el step:
 *   const login = PageFactory.get(LoginPage);
 *   await login.login('1234');
 */
export class PageFactory {
    private static dm:       AppiumDriverManager;
    private static executor: MobileStepExecutor;
    private static lm:       LocatorManager;
    private static cache     = new Map<Function, any>();

    /**
     * Inicializa la factory con las dependencias base.
     * Llamar en el Before() de cada step file.
     * Limpia el caché para que cada escenario arranque limpio.
     */
    static init(
        dm:       AppiumDriverManager,
        executor: MobileStepExecutor,
        lm:       LocatorManager
    ): void {
        PageFactory.dm       = dm;
        PageFactory.executor = executor;
        PageFactory.lm       = lm;
        PageFactory.cache.clear();
    }

    /**
     * Devuelve la instancia cacheada de un Page Object.
     * La crea si no existe aún.
     *
     * Ejemplo: PageFactory.get(LoginPage)
     */
    static get<T>(PageClass: new (dm: AppiumDriverManager, executor: MobileStepExecutor, lm: LocatorManager) => T): T {
        if (!PageFactory.cache.has(PageClass)) {
            PageFactory.cache.set(
                PageClass,
                new PageClass(PageFactory.dm, PageFactory.executor, PageFactory.lm)
            );
        }
        return PageFactory.cache.get(PageClass) as T;
    }


    /** Página base — para steps genéricos grabados con el recorder */
    static get base(): BasePage {
        return PageFactory.get(BasePage);
    }

    static get login(): LoginPage {
        return PageFactory.get(LoginPage);
    }

    static get home(): HomePage {
        return PageFactory.get(HomePage);
    }
}
