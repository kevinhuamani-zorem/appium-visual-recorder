window.addEventListener('DOMContentLoaded', async () => {

    const api = window.api;

    let selectedStepIndex = -1;
    let currentUdid = '';

    // ─── ELEMENTOS CONFIG ────────────────────────────────────────────────────
    const screenConfig    = document.getElementById('screenConfig');
    const screenRecorder  = document.getElementById('screenRecorder');
    const cmbDevices      = document.getElementById('cmbDevices');
    const lblDeviceInfo   = document.getElementById('lblDeviceInfo');
    const btnRefreshDev   = document.getElementById('btnRefreshDevices');
    const txtPackage      = document.getElementById('txtPackage');
    const txtActivity     = document.getElementById('txtActivity');
    const txtPlatformV    = document.getElementById('txtPlatformVersion');
    const txtApkPath      = document.getElementById('txtApkPath');
    const btnDetectApp    = document.getElementById('btnDetectApp');
    const btnStart        = document.getElementById('btnStartSession');
    const lblConfigSt     = document.getElementById('lblConfigStatus');

    // ─── ELEMENTOS RECORDER ──────────────────────────────────────────────────
    const lblDevice       = document.getElementById('lblDevice');
    const btnRefreshScr   = document.getElementById('btnRefreshScreen');
    const btnCloseSession = document.getElementById('btnCloseSession');
    const imgDevice       = document.getElementById('imgDevice');
    const devicePH        = document.getElementById('devicePlaceholder');
    const btnInspect      = document.getElementById('btnInspect');
    const lblInspect      = document.getElementById('lblInspectStatus');
    const txtSelector     = document.getElementById('txtSelector');
    const txtVarName      = document.getElementById('txtVarName');
    const btnCopy         = document.getElementById('btnCopy');
    const btnVerify       = document.getElementById('btnVerify');
    const lblVerify       = document.getElementById('lblVerifyResult');
    const cmbAction       = document.getElementById('cmbAction');
    const txtValue        = document.getElementById('txtValue');
    const txtDesc         = document.getElementById('txtDesc');
    const btnExecute      = document.getElementById('btnExecute');
    const lstSteps        = document.getElementById('lstSteps');
    const txtGherkin      = document.getElementById('txtGherkin');
    const txtFeature      = document.getElementById('txtFeature');
    const txtScenario     = document.getElementById('txtScenario');
    const btnPreview      = document.getElementById('btnPreview');
    const btnGenerate     = document.getElementById('btnGenerate');
    const btnDelete       = document.getElementById('btnDeleteStep');
    const btnClear        = document.getElementById('btnClearSteps');
    const lblStatus       = document.getElementById('lblStatus');
    const lblGenerate     = document.getElementById('lblGenerateResult');

    // ─── ELEMENTOS HIERARCHY VIEWER ──────────────────────────────────────────
    const xmlModal        = document.getElementById('xmlModal');
    const hierImg         = document.getElementById('hierImg');
    const hierCanvas      = document.getElementById('hierCanvas');
    const hierScreenWrap  = document.getElementById('hierScreenWrap');
    const hierTree        = document.getElementById('hierTree');
    const hierAttrs       = document.getElementById('hierAttrs');
    const hierXpathSug    = document.getElementById('hierXpathSuggestions');
    const txtXpathManual  = document.getElementById('txtXpathManual');
    const btnVerifyXpathM = document.getElementById('btnVerifyXpathManual');
    const btnUseXpath     = document.getElementById('btnUseXpath');
    const lblXmlVerify    = document.getElementById('lblXmlVerify');
    const btnRefreshXml   = document.getElementById('btnRefreshXml');
    const btnCloseXml     = document.getElementById('btnCloseXml');
    const btnXmlInspector = document.getElementById('btnXmlInspector');

    // ─── ESTADO HIERARCHY ────────────────────────────────────────────────────
    let currentXml     = '';
    let parsedElements = [];
    let deviceW        = 1080;
    let deviceH        = 2340;

    // ─── HELPERS GENERALES ───────────────────────────────────────────────────
    function setStatus(msg, color) {
        if (!lblStatus) return;
        lblStatus.textContent = msg;
        lblStatus.style.color = color || '#888AAA';
    }

    function setConfigStatus(msg, type) {
        if (!lblConfigSt) return;
        lblConfigSt.textContent = msg;
        lblConfigSt.className = 'config-status' + (type ? ' ' + type : '');
    }

    function setVerify(msg, type) {
        if (!lblVerify) return;
        lblVerify.textContent = msg;
        lblVerify.className = 'verify-result' + (type ? ' ' + type : '');
    }

    function setInspect(msg, type) {
        if (!lblInspect) return;
        lblInspect.textContent = msg;
        lblInspect.className = 'inspect-status' + (type ? ' ' + type : '');
    }

    function setGenerate(msg, type) {
        if (!lblGenerate) return;
        lblGenerate.textContent = msg;
        lblGenerate.className = 'generate-result' + (type ? ' ' + type : '');
    }

    function disableBtn(btn, text) {
        if (!btn) return;
        btn.disabled = true;
        btn.dataset.original = btn.textContent;
        btn.textContent = text;
    }

    function enableBtn(btn) {
        if (!btn) return;
        btn.disabled = false;
        btn.textContent = btn.dataset.original || btn.textContent;
    }

    function updateDeviceScreen(base64) {
        if (!base64 || !imgDevice) return;
        imgDevice.src = base64;
        imgDevice.style.display = 'block';
        if (devicePH) devicePH.style.display = 'none';
    }

    function renderSteps(steps) {
        if (!lstSteps) return;
        lstSteps.innerHTML = '';
        if (!steps || steps.length === 0) {
            lstSteps.innerHTML = '<li class="step-empty">Sin steps grabados...</li>';
            return;
        }
        steps.forEach((s, i) => {
            const li = document.createElement('li');
            li.textContent = (i + 1) + '. ' + stepSummary(s);
            li.dataset.index = i;
            if (i === selectedStepIndex) li.classList.add('selected');
            li.addEventListener('click', () => {
                selectedStepIndex = i;
                document.querySelectorAll('#lstSteps li').forEach(el => el.classList.remove('selected'));
                li.classList.add('selected');
            });
            lstSteps.appendChild(li);
        });
    }

    function stepSummary(step) {
        const loc = step.variableName ? '{' + step.variableName + '}' : (step.selector || '');
        const map = {
            ABRIR_APP:           '📱 ABRIR APP → ' + step.value,
            CLICK:               '👆 CLICK → ' + loc,
            ESCRIBIR:            '✏️ ESCRIBIR "' + step.value + '" → ' + loc,
            LIMPIAR:             '🧹 LIMPIAR → ' + loc,
            SCROLL_DOWN:         '⬇️ SCROLL DOWN',
            SCROLL_UP:           '⬆️ SCROLL UP',
            SCROLL_HASTA:        '🔍 SCROLL HASTA → ' + loc,
            SWIPE:               '👉 SWIPE ' + step.value,
            PRESION_LARGA:       '👇 PRESION LARGA → ' + loc,
            VERIFICAR_TEXTO:     '✅ VERIFICAR TEXTO "' + step.value + '" → ' + loc,
            VERIFICAR_EXISTE:    '👁️ VERIFICAR EXISTE → ' + loc,
            VERIFICAR_NO_EXISTE: '🚫 VERIFICAR NO EXISTE → ' + loc,
            VOLVER:              '◀️ VOLVER',
            ESPERAR:             '⏳ ESPERAR ' + step.value + 's',
            SCREENSHOT:          '📸 SCREENSHOT',
        };
        return map[step.action] || step.description || step.action;
    }

    function clearStepFields() {
        if (txtSelector) txtSelector.value = '';
        if (txtVarName)  txtVarName.value  = '';
        if (txtValue)    txtValue.value    = '';
        if (txtDesc)     txtDesc.value     = '';
        setVerify('— Ingresa un selector');
    }

    // ─── CONFIG ──────────────────────────────────────────────────────────────
    async function loadDevices() {
        lblDeviceInfo.textContent = 'Buscando...';
        const result = await api.getDevices();
        cmbDevices.innerHTML = '';
        if (!result.devices || result.devices.length === 0) {
            cmbDevices.innerHTML = '<option value="">Sin dispositivos</option>';
            lblDeviceInfo.textContent = 'Conecta un dispositivo via USB';
            return;
        }
        result.devices.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.udid;
            opt.textContent = (d.model || d.udid) + ' (Android ' + (d.version || '?') + ')';
            cmbDevices.appendChild(opt);
        });
        currentUdid = result.devices[0].udid;
        lblDeviceInfo.textContent = '✓ ' + result.devices.length + ' dispositivo(s)';
        lblDeviceInfo.className = 'device-info ok';
    }

    cmbDevices.addEventListener('change', () => { currentUdid = cmbDevices.value; });
    btnRefreshDev.addEventListener('click', loadDevices);

    btnDetectApp.addEventListener('click', async () => {
        if (!currentUdid) return;
        disableBtn(btnDetectApp, '⏳');
        const app = await api.getForegroundApp(currentUdid);
        enableBtn(btnDetectApp);
        if (app.package) {
            txtPackage.value  = app.package;
            txtActivity.value = app.activity;
            setConfigStatus('✓ App: ' + app.package, 'ok');
        } else {
            setConfigStatus('⚠ No se detecto app', 'err');
        }
    });

    btnStart.addEventListener('click', async () => {
        const udid    = cmbDevices.value;
        const pkg     = txtPackage.value.trim();
        const act     = txtActivity.value.trim();
        const version = txtPlatformV.value.trim();
        const apk     = txtApkPath.value.trim();

        if (!udid) { setConfigStatus('⚠ Selecciona dispositivo', 'err'); return; }
        if (!pkg)  { setConfigStatus('⚠ Ingresa el package', 'err');     return; }

        const deviceName = cmbDevices.options[cmbDevices.selectedIndex].text;

        // Mostrar recorder ANTES de conectar
        screenConfig.style.cssText   = 'display:none !important';
        screenRecorder.style.cssText = 'display:flex !important; flex-direction:column';
        lblDevice.textContent        = deviceName + ' — conectando...';
        setStatus('🔄 Conectando con Appium...', '#FF6600');

        await new Promise(r => setTimeout(r, 50));

        const config = {
            deviceName, udid, platformVersion: version,
            appPackage: pkg, appActivity: act || '.MainActivity',
            ...(apk ? { appPath: apk } : {})
        };

        try {
            const result = await api.startSession(config);
            if (result.success) {
                lblDevice.textContent = deviceName;
                setStatus('✓ Sesion activa — ' + deviceName, '#00CC00');
                if (result.screenshot) updateDeviceScreen(result.screenshot);
            } else {
                screenRecorder.style.cssText = 'display:none !important';
                screenConfig.style.cssText   = 'display:flex !important; flex-direction:column';
                setConfigStatus('✗ ' + result.error, 'err');
            }
        } catch (e) {
            screenRecorder.style.cssText = 'display:none !important';
            screenConfig.style.cssText   = 'display:flex !important; flex-direction:column';
            setConfigStatus('✗ Error: ' + e.message, 'err');
        }
    });

    // ─── RECORDER ────────────────────────────────────────────────────────────
    btnRefreshScr.addEventListener('click', async () => {
        const r = await api.getScreenshot();
        if (r.success) updateDeviceScreen(r.screenshot);
    });

    btnCloseSession.addEventListener('click', async () => {
        await api.closeSession();
        screenRecorder.style.cssText = 'display:none !important';
        screenConfig.style.cssText   = 'display:flex !important; flex-direction:column';
        if (imgDevice) imgDevice.src = '';
        if (devicePH)  devicePH.style.display = 'block';
        setConfigStatus('Sesion cerrada', '');
    });

    btnInspect.addEventListener('click', async () => {
        disableBtn(btnInspect, '⏳ Toca un elemento...');
        setInspect('Toca un elemento en el dispositivo...', 'active');
        setStatus('📱 Esperando toque...', '#FF6600');

        const result = await api.activateInspector();
        enableBtn(btnInspect);

        if (result.success) {
            txtSelector.value = result.xpath;
            txtVarName.value  = result.suggested;
            if (result.screenshot) updateDeviceScreen(result.screenshot);
            setInspect('✓ XPath: ' + result.xpath, 'ok');
            setStatus('✓ Elemento capturado', '#00CC00');
        } else {
            setInspect('Cancelado o timeout', '');
            setStatus('⚠ Inspector cancelado', '#FF6600');
        }
    });

    btnCopy.addEventListener('click', () => {
        navigator.clipboard.writeText(txtSelector.value);
        setStatus('📋 Copiado', '#2E75B6');
    });

    btnVerify.addEventListener('click', async () => {
        const selector = txtSelector.value.trim();
        if (!selector) { setVerify('⚠ Ingresa un selector', 'err'); return; }
        disableBtn(btnVerify, '⏳ Verificando...');
        const result = await api.verifySelector(selector);
        enableBtn(btnVerify);
        if (result.success) {
            if (result.screenshot) updateDeviceScreen(result.screenshot);
            setVerify(result.summary, 'ok');
            setStatus('✓ Verificado', '#00CC00');
        } else {
            setVerify(result.summary, 'err');
            setStatus('✗ No encontrado', '#CC0000');
        }
    });

    cmbAction.addEventListener('change', () => {
        const action  = cmbAction.value;
        const noSel   = ['ABRIR_APP','SCROLL_DOWN','SCROLL_UP','VOLVER','ESPERAR','SCREENSHOT'];
        txtSelector.disabled = noSel.includes(action);
        txtVarName.disabled  = noSel.includes(action);
        const ph = {
            ABRIR_APP: 'com.example.app', ESCRIBIR: 'texto...',
            SWIPE: 'left/right/up/down', VERIFICAR_TEXTO: 'texto esperado',
            ESPERAR: 'segundos', SCREENSHOT: 'nombre'
        };
        txtValue.placeholder = ph[action] || '';
    });

    btnExecute.addEventListener('click', async () => {
        const action   = cmbAction.value;
        const selector = txtSelector.value.trim();
        const varName  = txtVarName.value.trim();
        const value    = txtValue.value.trim();
        const desc     = txtDesc.value.trim();
        const noSel    = ['ABRIR_APP','SCROLL_DOWN','SCROLL_UP','VOLVER','ESPERAR','SCREENSHOT'];

        if (!noSel.includes(action) && !selector) {
            setStatus('⚠ Ingresa un selector', '#FF6600'); return;
        }

        const step = { action, variableName: varName, selector, value, description: desc };
        disableBtn(btnExecute, '⏳ Ejecutando...');
        setStatus('⚡ Ejecutando...', '#FF6600');

        const result = await api.executeStep(step);
        enableBtn(btnExecute);

        if (result.success) {
            if (result.screenshot) updateDeviceScreen(result.screenshot);
            setStatus('✓ Step ' + result.totalSteps + ' guardado', '#00CC00');
            clearStepFields();
            const sr = await api.getSteps();
            renderSteps(sr.steps);
            const pr = await api.previewGherkin(
                txtFeature.value.trim() || 'Flujo mobile',
                txtScenario.value.trim() || 'Escenario'
            );
            if (pr.success && txtGherkin) txtGherkin.value = pr.preview;
        } else {
            setStatus('✗ ' + result.message, '#CC0000');
        }
    });

    btnDelete.addEventListener('click', async () => {
        if (selectedStepIndex < 0) { setStatus('⚠ Selecciona un step', '#FF6600'); return; }
        await api.deleteStep(selectedStepIndex);
        selectedStepIndex = -1;
        const r = await api.getSteps();
        renderSteps(r.steps);
        setStatus('🗑️ Eliminado', '#FF6600');
    });

    btnClear.addEventListener('click', async () => {
        await api.clearSteps();
        selectedStepIndex = -1;
        renderSteps([]);
        if (txtGherkin) txtGherkin.value = '';
        setStatus('🧹 Limpiado', '#666888');
    });

    btnPreview.addEventListener('click', async () => {
        const r = await api.previewGherkin(
            txtFeature.value.trim() || 'Flujo mobile',
            txtScenario.value.trim() || 'Escenario'
        );
        if (r.success && txtGherkin) txtGherkin.value = r.preview;
    });

    btnGenerate.addEventListener('click', async () => {
        disableBtn(btnGenerate, '⏳ Generando...');
        const r = await api.generateFiles(
            txtFeature.value.trim() || 'Flujo mobile',
            txtScenario.value.trim() || 'Escenario'
        );
        enableBtn(btnGenerate);
        if (r.success) {
            setGenerate('✓ ' + r.featurePath, 'ok');
            setStatus('✓ Generado', '#00CC00');
        } else {
            setGenerate('✗ ' + r.error, 'err');
        }
    });

    // ─── HIERARCHY VIEWER ────────────────────────────────────────────────────
    function getAttrVal(attrs, name) {
        const m = attrs.match(new RegExp('\\b' + name + '="([^"]*)"'));
        return m ? m[1] : '';
    }

    function parseElements(xml) {
        const elements = [];
        const re = /<([\w.]+)\s([^>]*?)(?:\/>|>)/g;
        let m;
        while ((m = re.exec(xml)) !== null) {
            const tag    = m[1];
            const attrs  = m[2];
            const bounds = getAttrVal(attrs, 'bounds');
            if (!bounds) continue;
            const bm = bounds.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
            if (!bm) continue;
            const x1 = parseInt(bm[1]), y1 = parseInt(bm[2]);
            const x2 = parseInt(bm[3]), y2 = parseInt(bm[4]);
            if (x2 <= x1 || y2 <= y1) continue;
            elements.push({
                tag, attrs,
                resourceId:  getAttrVal(attrs, 'resource-id'),
                text:        getAttrVal(attrs, 'text'),
                contentDesc: getAttrVal(attrs, 'content-desc'),
                clickable:   getAttrVal(attrs, 'clickable'),
                focusable:   getAttrVal(attrs, 'focusable'),
                focused:     getAttrVal(attrs, 'focused'),
                enabled:     getAttrVal(attrs, 'enabled'),
                displayed:   getAttrVal(attrs, 'displayed'),
                className:   getAttrVal(attrs, 'class'),
                x1, y1, x2, y2
            });
        }
        // Menor area primero = mas especifico
        elements.sort((a, b) =>
            ((a.x2-a.x1)*(a.y2-a.y1)) - ((b.x2-b.x1)*(b.y2-b.y1))
        );
        return elements;
    }

    function findElementAt(px, py) {
        let best = null, bestArea = Infinity;
        parsedElements.forEach(el => {
            if (px >= el.x1 && px <= el.x2 && py >= el.y1 && py <= el.y2) {
                const area = (el.x2-el.x1)*(el.y2-el.y1);
                if (area < bestArea) { bestArea = area; best = el; }
            }
        });
        return best;
    }

    function drawRect(el, color, fill, lineWidth) {
        const ctx = hierCanvas.getContext('2d');
        const w   = hierCanvas.width;
        const h   = hierCanvas.height;
        const sx  = w / deviceW;
        const sy  = h / deviceH;
        ctx.strokeStyle = color;
        ctx.lineWidth   = lineWidth || 2;
        ctx.fillStyle   = fill;
        ctx.fillRect  (el.x1*sx, el.y1*sy, (el.x2-el.x1)*sx, (el.y2-el.y1)*sy);
        ctx.strokeRect(el.x1*sx, el.y1*sy, (el.x2-el.x1)*sx, (el.y2-el.y1)*sy);
    }

    function syncCanvas() {
        hierCanvas.width  = hierImg.offsetWidth;
        hierCanvas.height = hierImg.offsetHeight;
    }

    function showAttrs(el) {
        if (!el) { hierAttrs.innerHTML = '<span class="hier-hint">Sin elemento</span>'; return; }
        const KEYS = ['class','resource-id','text','content-desc',
                      'clickable','focusable','focused','enabled','displayed','bounds'];
        let html = '';
        KEYS.forEach(k => {
            const v = getAttrVal(el.attrs, k);
            if (!v) return;
            let vc = 'hier-attr-val';
            if (k==='clickable' && v==='true') vc += ' clickable-true';
            if (k==='focused'   && v==='true') vc += ' focused-true';
            html += '<div class="hier-attr-row">' +
                    '<span class="hier-attr-key">' + k + '</span>' +
                    '<span class="' + vc + '">' + v + '</span></div>';
        });
        hierAttrs.innerHTML = html || '<span class="hier-hint">Sin atributos</span>';
    }

    function showNodeInTree(el) {
        if (!el) return;
        const short = (el.className || el.tag).split('.').pop();
        const info  = el.resourceId ? (el.resourceId.split('/')[1] || el.resourceId)
                    : el.text       ? el.text.slice(0, 24)
                    : el.contentDesc? el.contentDesc.slice(0, 24) : '';
        hierTree.innerHTML =
            '<div class="hier-node selected">' +
            '<span class="node-tag">&lt;' + short + '&gt;</span>' +
            (info ? ' <span class="node-id">' + info + '</span>' : '') +
            '</div>' +
            '<div style="font-size:10px;color:#666888;padding:4px 8px">' +
            el.x1+','+el.y1+' → '+el.x2+','+el.y2+
            ' ('+Math.round(el.x2-el.x1)+'×'+Math.round(el.y2-el.y1)+')' +
            '</div>';
    }

    function showXpathSuggestions(el) {
        hierXpathSug.innerHTML = '';
        if (!el) return;
        const IGNORED = ['android:id/content','android:id/navigationBarBackground'];
        const suggestions = [];

        if (el.resourceId && !IGNORED.includes(el.resourceId)) {
            suggestions.push({ label: 'resource-id', xpath: '//*[@resource-id="' + el.resourceId + '"]' });
            const idOnly = el.resourceId.split('/')[1];
            if (idOnly) suggestions.push({ label: 'id contains', xpath: '//*[contains(@resource-id,"' + idOnly + '")]' });
        }
        if (el.contentDesc) {
            suggestions.push({ label: 'content-desc', xpath: '//*[@content-desc="' + el.contentDesc + '"]' });
        }
        if (el.text && el.text.length > 0 && el.text.length < 60) {
            suggestions.push({ label: 'text exact', xpath: '//*[@text="' + el.text + '"]' });
            if (el.text.length > 4)
                suggestions.push({ label: 'text contains', xpath: '//*[contains(@text,"' + el.text.slice(0,20) + '")]' });
        }
        if (el.className) {
            suggestions.push({ label: 'class', xpath: '//' + el.className });
        }

        suggestions.forEach(s => {
            const chip = document.createElement('div');
            chip.className = 'xpath-chip';
            chip.innerHTML = '<span class="chip-label">' + s.label + '</span>' +
                             '<span>' + s.xpath + '</span>';
            chip.addEventListener('click', () => {
                txtXpathManual.value = s.xpath;
                document.querySelectorAll('.xpath-chip').forEach(c => c.style.borderColor = '');
                chip.style.borderColor = '#7030A0';
            });
            hierXpathSug.appendChild(chip);
        });

        if (suggestions.length > 0) txtXpathManual.value = suggestions[0].xpath;
    }

    // Click en screenshot
    hierScreenWrap.addEventListener('click', e => {
        if (!parsedElements.length) return;
        const rect = hierImg.getBoundingClientRect();
        const px   = Math.round(((e.clientX - rect.left) / rect.width)  * deviceW);
        const py   = Math.round(((e.clientY - rect.top)  / rect.height) * deviceH);
        const el   = findElementAt(px, py);
        if (!el) return;

        syncCanvas();
        const ctx = hierCanvas.getContext('2d');
        ctx.clearRect(0, 0, hierCanvas.width, hierCanvas.height);
        drawRect(el, '#FF6600', 'rgba(255,102,0,0.15)', 2.5);

        showAttrs(el);
        showNodeInTree(el);
        showXpathSuggestions(el);
        lblXmlVerify.textContent = '— Verifica antes de usar';
        lblXmlVerify.className   = 'verify-result';
    });

    // Hover en screenshot
    hierScreenWrap.addEventListener('mousemove', e => {
        if (!parsedElements.length) return;
        const rect = hierImg.getBoundingClientRect();
        const px   = Math.round(((e.clientX - rect.left) / rect.width)  * deviceW);
        const py   = Math.round(((e.clientY - rect.top)  / rect.height) * deviceH);
        const el   = findElementAt(px, py);

        syncCanvas();
        const ctx = hierCanvas.getContext('2d');
        ctx.clearRect(0, 0, hierCanvas.width, hierCanvas.height);
        if (el) drawRect(el, 'rgba(0,200,255,0.9)', 'rgba(0,200,255,0.06)', 1.5);
    });

    hierScreenWrap.addEventListener('mouseleave', () => {
        syncCanvas();
        hierCanvas.getContext('2d').clearRect(0, 0, hierCanvas.width, hierCanvas.height);
    });

    // Abrir inspector
    btnXmlInspector.addEventListener('click', async () => {
        xmlModal.style.display = 'flex';
        await refreshHierarchy();
    });

    async function refreshHierarchy() {
        hierTree.innerHTML    = '<span class="hier-hint">Cargando...</span>';
        hierAttrs.innerHTML   = '<span class="hier-hint">...</span>';
        hierXpathSug.innerHTML = '';

        const [screenshotR, xmlR] = await Promise.all([
            api.getScreenshot(),
            api.getPageSource()
        ]);

        if (screenshotR.success) hierImg.src = screenshotR.screenshot;

        if (xmlR.success) {
            currentXml     = xmlR.xml;
            parsedElements = parseElements(currentXml);

            const wm = currentXml.match(/width="(\d+)"/);
            const hm = currentXml.match(/height="(\d+)"/);
            if (wm) deviceW = parseInt(wm[1]);
            if (hm) deviceH = parseInt(hm[1]);

            hierTree.innerHTML = '<span class="hier-hint">' +
                parsedElements.length + ' elementos — haz click en la imagen</span>';
        } else {
            hierTree.innerHTML = '<span style="color:#CC0000">Error cargando XML</span>';
        }
    }

    btnRefreshXml.addEventListener('click', refreshHierarchy);

    btnCloseXml.addEventListener('click', () => {
        xmlModal.style.display = 'none';
        syncCanvas();
        hierCanvas.getContext('2d').clearRect(0, 0, hierCanvas.width, hierCanvas.height);
    });

    btnVerifyXpathM.addEventListener('click', async () => {
        const xpath = txtXpathManual.value.trim();
        if (!xpath) return;
        lblXmlVerify.textContent = '⏳ Verificando...';
        lblXmlVerify.className   = 'verify-result';
        const r = await api.verifySelector(xpath);
        if (r.success) {
            lblXmlVerify.textContent = r.summary;
            lblXmlVerify.className   = 'verify-result ok';
        } else {
            lblXmlVerify.textContent = r.summary;
            lblXmlVerify.className   = 'verify-result err';
        }
    });

    btnUseXpath.addEventListener('click', () => {
        const xpath = txtXpathManual.value.trim();
        if (!xpath) return;
        txtSelector.value = xpath;
        const patterns = [
            /@resource-id="[^"]*\/([^"]+)"/,
            /@resource-id="([^"]+)"/,
            /@content-desc="([^"]+)"/,
            /@text="([^"]+)"/
        ];
        for (const re of patterns) {
            const m = xpath.match(re);
            if (m) {
                txtVarName.value = m[1].toLowerCase()
                    .replace(/[^a-z0-9]/g, '_')
                    .replace(/_+/g, '_')
                    .replace(/^_|_$/g, '');
                break;
            }
        }
        xmlModal.style.display = 'none';
        setStatus('✓ XPath cargado desde Hierarchy Viewer', '#00CC00');
    });

    // ─── INIT ────────────────────────────────────────────────────────────────
    screenConfig.style.cssText   = 'display:flex !important; flex-direction:column';
    screenRecorder.style.cssText = 'display:none !important';
    await loadDevices();
});
