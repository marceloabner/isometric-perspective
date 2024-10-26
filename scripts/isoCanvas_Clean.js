const MODULE_ID = "isometric-perspective"

// Hook para registrar a configuração do módulo no Foundry VTT
Hooks.once("init", function() {
  // Registrar a configuração do checkbox para habilitar ou desabilitar o modo isométrico globalmente
  game.settings.register(MODULE_ID, "worldIsometricFlag", {
    name: "Enable Isometric Perspective",
    hint: "Toggle whether the isometric perspective is applied to the canvas.",
    scope: "world",  // "world" = sync to db, "client" = local storage
    config: true,    // false if you dont want it to show in module config
    type: Boolean,   // You want the primitive class, e.g. Number, not the name of the class as a string
    default: true, 
    onChange: settings => window.location.reload()
    //requiresReload: true, // true if you want to prompt the user to reload
  });

  game.settings.register(MODULE_ID, 'debug', {
    name: 'Enable Debug Mode',
    hint: 'Enables debug prints',
    scope: 'client',
    config: true,
    default: false,
    type: Boolean,
    onChange: settings => window.location.reload()
  });
});


// -------- ADICIONA CONFIG NA ABA SCENES --------------------------------------

// Hook para adicionar a nova aba de configurações à cena
Hooks.on("renderSceneConfig", async (sceneConfig, html, data) => {
  // Carrega o documento HTML padrão
  const tabHtml = await renderTemplate("modules/isometric-perspective/templates/scene-config.html");
  
  // Adicionar a aba ao menu e adiciona o conteúdo da aba
  html.find(".tabs").append(`<a class="item" data-tab="isometric"><i class="fas fa-cube"></i> Isometric</a>`);
  html.find(".tab[data-tab='ambience']").after(`<div class="tab" data-tab="isometric">${tabHtml}</div>`);

  // Lógica para lidar com o estado do checkbox
  const checkbox = html.find("#isometricEnabled");
  checkbox.prop("checked", sceneConfig.object.getFlag(MODULE_ID, "isometricEnabled"));

  // Atualiza o flag quando o checkbox é alterado
  checkbox.on("change", async (event) => {
    const isIsometric = event.target.checked;
    if (isIsometric === true) {
      await sceneConfig.object.setFlag(MODULE_ID, "isometricEnabled", isIsometric);
    }
    else {
      await sceneConfig.object.unsetFlag(MODULE_ID, "isometricEnabled");
    }
    applyIsometricPerspective(sceneConfig.object, isIsometric);
  });

});


// ---------------- MEU HUD -------------------------------

// Função para calcular a posição isométrica
function calculateIsometricPosition(x, y) {
  const isoAngle = Math.PI / 6; // 30 graus em radianos
  const isoX = (x + y) * Math.cos(isoAngle);
  const isoY = (-1) * (x - y) * Math.sin(isoAngle);
  return { x: isoX, y: isoY };
}

// Função para ajustar a posição do HUD
function adjustHUDPosition(hud, html) {
  const token = hud.object;
  const { width, height } = token;
  const { x, y } = token.position;

  // Calcula a posição isométrica do topo central do token
  const topCenter = calculateIsometricPosition(x + (width / 2), y);

  // Aplica um offset vertical baseado na altura do token para posicionar o HUD acima do token
  const offsetY = height * Math.sin(Math.PI / 6);

  // Ajusta a posição do HUD
  html.css({
    left: `${topCenter.x + (height * 0.3)}px`,
    top: `${topCenter.y - offsetY + (width * 1.33)}px`,
    transform: 'translate(-50%, -100%)' // Centraliza horizontalmente e posiciona acima do token
  });
}


// Hook para ajustar a posição do TokenHUD quando ele é renderizado
Hooks.on("renderTokenHUD", (hud, html, data) => {
  const scene = game.scenes.current;
  const isIsometric = scene.getFlag(MODULE_ID, "isometricEnabled");
  const isometricWorldEnabled = game.settings.get(MODULE_ID, "worldIsometricFlag");

  // requestAnimationFrame garante que a transformação ocorre dentro do tempo de execução e no tempo correto
  if (isometricWorldEnabled && isIsometric) {
    requestAnimationFrame(() => adjustHUDPosition(hud, html));
  }
});
/*
// Mesma coisa que o de cima, só que usando um hook mais genérico
// Provavelmente vai ser melhor do que chamar o anterior
Hooks.on("renderApplication", (app, html, data) => {
  // Verifica se a aplicação sendo renderizada é a TokenHUD
  if (app instanceof TokenHUD) {
    const selectedToken = app.object;  // O token associado à HUD

    // Aqui você pode aplicar as modificações necessárias na HUD
    console.log("Token HUD is being rendered for:", selectedToken);

    // Exemplo de ajuste na HUD (posição, estilo, etc.)
    requestAnimationFrame(() => adjustHUDPosition(app, html));
  }
});
*/






// -------- FUNÇÕES --------------------------------------
// Função para aplicar a perspectiva isométrica no Canvas
function applyIsometricPerspective(scene, isIsometric) {
  console.log("testing aplicando Isometric na Scene");
  const isometricWorldEnabled = game.settings.get(MODULE_ID, "worldIsometricFlag");
  const isoAngle = Math.PI/6;
  
  // Se o modo isométrico está habilitado globalmente e na cena específica
  if (isometricWorldEnabled && isIsometric) {
    canvas.stage.rotation = -isoAngle;
    canvas.stage.skew.set( isoAngle, 0);
    adjustAllTokensForIsometric();
  } else {
    canvas.stage.rotation = 0;
    canvas.stage.skew.set(0, 0);
  }
}

// Ajusta todos os tokens na cena para visão isométrica
function adjustAllTokensForIsometric() {
  canvas.tokens.placeables.forEach(token => applyTokenTransformation(token));
}

// Ajusta o token selecionado para visão isométrica
function applyTokenTransformation(token, isIsometric) {
  const isometricWorldEnabled = game.settings.get(MODULE_ID, "worldIsometricFlag"); // Flag global que identifica se o módulo isométrico está ativo
  const tokenScale = token.document.texture; // Obtém as dimensões originais da imagem da arte do token
  const tokenDimW = token.document.width;    // Obtém as dimensões do token
  const tokenDimH = token.document.height;   // Obtém as dimensões do token
  const texture = token.texture;
  const originalWidth = texture.width;
  const originalHeight = texture.height;
  let ratio = originalWidth / originalHeight;
  
  // Obtém os valores das flags do token
  const offsetX = token.document.getFlag(MODULE_ID, 'offsetX') ?? 0;
  const offsetY = token.document.getFlag(MODULE_ID, 'offsetY') ?? 0;
  const isoScale = token.document.getFlag(MODULE_ID, 'scale') ?? 1;
  
  // Verifica se o token tem um mesh válido
  if (!token.mesh) {
    if (game.settings.get(MODULE_ID, "debug")) {
      console.warn("Token mesh não encontrado:", token);
    }
    return;
  }

  // O módulo está ativado e a cena é isométrica?
  if (isometricWorldEnabled && isIsometric) {
    // Reseta transformações anteriores e aplica a transformação considerando a escala isométrica
    token.mesh.rotation = Math.PI/4;
    token.mesh.skew.set(0, 0);
    token.mesh.scale.set(
      tokenScale.scaleX * tokenDimH * ratio * isoScale,
      tokenScale.scaleY * tokenDimW * isoScale
    );
    
    // Converte os offsets cartesianos para isométricos
    const isoOffsets = cartesianToIso(offsetX, offsetY);
    
    // Aplica offset transformado à posição atual do token
    const currentX = token.document.x;
    const currentY = token.document.y;
    token.mesh.position.set(
      currentX + isoOffsets.x,
      currentY + isoOffsets.y
    );
  } else {
    // Reseta todas as transformações do mesh
    token.mesh.rotation = 0;
    token.mesh.skew.set(0, 0);
    token.mesh.scale.set(1, 1);
  }
}




// -------------- HOOKS ---------------------------------------

// Hook para quando um token é adicionado ao canvas
Hooks.on("createToken", (tokenDocument) => {
  const token = canvas.tokens.get(tokenDocument.id);
  if (!token) return;
  
  const scene = token.scene;
  const isIsometric = scene.getFlag(MODULE_ID, "isometricEnabled");
  requestAnimationFrame(() => applyTokenTransformation(token, isIsometric));
});

// Mantenha o hook updateToken
Hooks.on("updateToken", (tokenDocument, updateData, options, userId) => {
  const token = canvas.tokens.get(tokenDocument.id);
  if (!token) return;
  
  const scene = token.scene;
  const isIsometric = scene.getFlag(MODULE_ID, "isometricEnabled");
  
  if (updateData.flags?.[MODULE_ID] || updateData.x !== undefined || updateData.y !== undefined) {
    if (game.settings.get(MODULE_ID, "debug")) {
      console.log("Atualizando posição ou configurações isométricas do token:", updateData);
    }
    requestAnimationFrame(() => applyTokenTransformation(token, isIsometric));
  }
});

// Hook para quando um token precisa ser redesenhado
Hooks.on("refreshToken", (token) => {
  const scene = token.scene;
  const isIsometric = scene.getFlag(MODULE_ID, "isometricEnabled");
  applyTokenTransformation(token, isIsometric);
});

// Hook para aplicar a perspectiva isométrica quando a cena é ativada
Hooks.on("canvasReady", (canvas) => {
  console.log("testing hooks canvasReady");
  const activeScene = game.scenes.active;
  if (!activeScene) return;

  const scene = canvas.scene;
  const isIsometric = scene.getFlag(MODULE_ID, "isometricEnabled");
  applyIsometricPerspective(scene, isIsometric);
});













// Função auxiliar para converter coordenadas isométricas para cartesianas
function isoToCartesian(isoX, isoY) {
  const angle = Math.PI / 4; // 45 graus em radianos
  return {
    x: (isoX * Math.cos(angle) - isoY * Math.sin(angle)),
    y: (isoX * Math.sin(angle) + isoY * Math.cos(angle))
  };
}

// Função auxiliar para converter coordenadas cartesianas para isométricas
function cartesianToIso(cartX, cartY) {
  const angle = Math.PI / 4; // 45 graus em radianos
  return {
    x: (cartX * Math.cos(-angle) - cartY * Math.sin(-angle)),
    y: (cartX * Math.sin(-angle) + cartY * Math.cos(-angle))
  };
}

// Adicione este hook para lidar com a janela de configuração do token
Hooks.on("renderTokenConfig", async (app, html, data) => {
  // Obtém os valores atuais das flags do token
  const offsetX = app.object.getFlag(MODULE_ID, 'offsetX') ?? 0;
  const offsetY = app.object.getFlag(MODULE_ID, 'offsetY') ?? 0;
  const scale = app.object.getFlag(MODULE_ID, 'scale') ?? 1;
  
  // Carrega o template HTML para a nova aba
  const tabHtml = `
    <div class="tab" data-tab="isometric">
      <div class="form-group offset-point">
        <label>Deslocamento da Arte</label>
        <div class="form-fields">
          <label class="axis">Horizontal</label>
          <input type="number" name="flags.${MODULE_ID}.offsetX" 
                 value="${offsetX}"
                 step="1" />
          <label class="axis">Vertical</label>
          <input type="number" name="flags.${MODULE_ID}.offsetY"
                 value="${offsetY}"
                 step="1" />
        </div>
        <p class="notes">Desloca a posição da arte do token em pixels.</p>
      </div>

      <div class="form-group">
        <label>Escala Isométrica</label>
        <div class="form-fields">
          <input type="range" name="flags.${MODULE_ID}.scale"
                 value="${scale}"
                 min="0.01" max="3" step="0.01"
                 class="scale-slider" />
          <span class="range-value">${scale}</span>
        </div>
        <p class="notes">Ajusta a escala do token quando em modo isométrico.</p>
      </div>
    </div>
  `;

  // Adiciona a nova aba ao menu
  const tabs = html.find('.tabs');
  tabs.append('<a class="item" data-tab="isometric"><i class="fas fa-cube"></i> Isometric</a>');
  
  // Adiciona o conteúdo da aba após a última aba existente
  const lastTab = html.find('.tab').last();
  lastTab.after(tabHtml);
  
  // Adiciona CSS para estilizar a nova aba
  const style = `
    <style>
      .offset-point .form-fields {
        display: flex;
        gap: 0.5em;
      }
      .offset-point .axis {
        flex: 0 0 60px;
        line-height: var(--form-field-height);
        text-align: center;
        color: var(--color-text-dark-secondary);
      }
      .offset-point input {
        flex: 1;
      }
      .scale-slider {
        flex: 4;
      }
      .range-value {
        flex: 1;
        text-align: center;
        line-height: var(--form-field-height);
      }
    </style>
  `;
  html.find('header').after(style);

  // Adiciona listener para atualizar o valor exibido do slider
  html.find('.scale-slider').on('input', function() {
    html.find('.range-value').text(this.value);
  });

  // Corrige a inicialização das tabs
  const tabsElement = html.find('.tabs');
  if (!app._tabs || app._tabs.length === 0) {
    app._tabs = [new Tabs({
      navSelector: ".tabs",
      contentSelector: ".sheet-body",
      initial: "appearance",
      callback: () => {}
    })];
    app._tabs[0].bind(html[0]);
  }
});