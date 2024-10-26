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

// -------- RENDER TEMPLATES -------------------------------------------------------------------------------------------------------
// Hook para adicionar a nova aba de configurações à cena
Hooks.on("renderSceneConfig", async (sceneConfig, html, data) => {
  const tabHtml = await renderTemplate("modules/isometric-perspective/templates/scene-config.html");
  
  html.find(".tabs").append(`<a class="item" data-tab="isometric"><i class="fas fa-cube"></i> Isometric</a>`);
  html.find(".tab[data-tab='ambience']").after(`<div class="tab" data-tab="isometric">${tabHtml}</div>`);

  // Checkbox para perspectiva isométrica
  const isoCheckbox = html.find("#isometricEnabled");
  isoCheckbox.prop("checked", sceneConfig.object.getFlag(MODULE_ID, "isometricEnabled"));

  // Checkbox para transformação do background
  const bgCheckbox = html.find("#isometricBackground");
  bgCheckbox.prop("checked", sceneConfig.object.getFlag(MODULE_ID, "isometricBackground"));

  // Handler para o checkbox da perspectiva isométrica
  isoCheckbox.on("change", async (event) => {
    const isIsometric = event.target.checked;
    const currentTab = sceneConfig._tabs[0].active; // Guarda a aba atual
    
    if (isIsometric === true) {
      await sceneConfig.object.setFlag(MODULE_ID, "isometricEnabled", isIsometric);
    } else {
      await sceneConfig.object.unsetFlag(MODULE_ID, "isometricEnabled");
    }
    
    // Aplica a transformação isométrica
    applyIsometricPerspective(sceneConfig.object, isIsometric);
    
    // Força a aba isométrica a permanecer ativa após a re-renderização
    requestAnimationFrame(() => {
      const tab = sceneConfig._tabs[0];
      tab.activate("isometric");
    });
  });

  // Handler para o checkbox da transformação do background
  bgCheckbox.on("change", async (event) => {
    const shouldTransform = event.target.checked;
    const currentTab = sceneConfig._tabs[0].active; // Guarda a aba atual
    if (shouldTransform === true) {
      await sceneConfig.object.setFlag(MODULE_ID, "isometricBackground", shouldTransform);
    } else {
      await sceneConfig.object.unsetFlag(MODULE_ID, "isometricBackground");
    }

    // Verifica se o canvas atual é o canvas que está sendo editado?
    // FALTA VERIFICAR SE ISSO ESTÁ CORRETO
    const isIsometric = sceneConfig.object.getFlag(MODULE_ID, "isometricEnabled");
    if (canvas.scene.id === sceneConfig.object.id) {
      applyIsometricPerspective(sceneConfig.object, isIsometric);
    }
    
    // Força a aba isométrica a permanecer ativa após a re-renderização
    requestAnimationFrame(() => {
      const tab = sceneConfig._tabs[0];
      tab.activate("isometric");
    });
  });
});

    // Verifica se o canvas atual é o canvas que está sendo editado?
    // FALTA VERIFICAR SE ISSO ESTÁ CORRETO

Hooks.on("renderGridConfig", (app, html, data) => {
  const scene = app.object;
  if (!scene) return;
  
  const isIsometric = scene.getFlag(MODULE_ID, "isometricEnabled");
  const shouldTransformBackground = scene.getFlag(MODULE_ID, "isometricBackground") ?? false;
  
  // Re-apply transformations when grid config is rendered
  if (isIsometric) {
    setTimeout(() => {
    
    requestAnimationFrame(() => {
      applyIsometricPerspective(scene, isIsometric);
      applyBackgroundTransformation(scene, isIsometric, shouldTransformBackground);
    });

    }, 100);
  }
  
  // Add listener for when grid config tool is being used
  html.find('.grid-config').on('change', () => {
    if (isIsometric) {
      requestAnimationFrame(() => {
        applyIsometricPerspective(scene, isIsometric);
        applyBackgroundTransformation(scene, isIsometric, shouldTransformBackground);
      });
    }
  });
});

Hooks.on("renderTokenConfig", async (app, html, data) => {
  // Carrega o template HTML para a nova aba
  const tabHtml = await renderTemplate("modules/isometric-perspective/templates/token-config.html", {
    offsetX: app.object.getFlag(MODULE_ID, 'offsetX') ?? 0,
    offsetY: app.object.getFlag(MODULE_ID, 'offsetY') ?? 0,
    scale: app.object.getFlag(MODULE_ID, 'scale') ?? 1
  });
  
  // Adiciona a nova aba ao menu
  const tabs = html.find('.tabs');
  tabs.append('<a class="item" data-tab="isometric"><i class="fas fa-cube"></i> Isometric</a>');
  
  // Adiciona o conteúdo da aba após a última aba existente
  const lastTab = html.find('.tab').last();
  lastTab.after(tabHtml);

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


Hooks.on("renderTileConfig", async (app, html, data) => {
  // Carrega o template HTML para a nova aba
  const tabHtml = await renderTemplate("modules/isometric-perspective/templates/tile-config.html", {
    reverseTransform: app.object.getFlag(MODULE_ID, 'reverseTransform') ?? true,
    scale: app.object.getFlag(MODULE_ID, 'scale') ?? 1
  });
  
  // Adiciona a nova aba ao menu
  const tabs = html.find('.tabs');
  tabs.append('<a class="item" data-tab="isometric"><i class="fas fa-cube"></i> Isometric</a>');
  
  // Adiciona o conteúdo da aba após a última aba existente
  const lastTab = html.find('.tab').last();
  lastTab.after(tabHtml);

  // Adiciona listener para atualizar o valor exibido do slider
  html.find('.scale-slider').on('input', function() {
    html.find('.range-value').text(this.value);
  });

  // Corrige a inicialização das tabs
  if (!app._tabs || app._tabs.length === 0) {
    app._tabs = [new Tabs({
      navSelector: ".tabs",
      contentSelector: ".sheet-body",
      initial: "image",
      callback: () => {}
    })];
    app._tabs[0].bind(html[0]);
  }
});










// -------- HOOKS ------------------------------------------------------------------------------------------------------------------
// Aplica a perspectiva isométrica aos tokens, tiles e background quando a cena termina de ser renderizada
Hooks.on("canvasReady", (canvas) => {
  //console.log("testing hooks canvasReady");
  const activeScene = game.scenes.active;
  if (!activeScene) return;

  const scene = canvas.scene;
  const isIsometric = scene.getFlag(MODULE_ID, "isometricEnabled");
  const shouldTransformBackground = scene.getFlag(MODULE_ID, "isometricBackground") ?? false;
  applyIsometricPerspective(scene, isIsometric);
  applyBackgroundTransformation(scene, isIsometric, shouldTransformBackground);
});

// Aplica a perspectiva isométrica ao background quando a cena for redimensionada
Hooks.on("canvasResize", (canvas) => {
  const scene = canvas.scene;
  if (!scene) return;
  
  const isIsometric = scene.getFlag(MODULE_ID, "isometricEnabled");
  const shouldTransformBackground = scene.getFlag(MODULE_ID, "isometricBackground") ?? false;
  
  if (isIsometric && shouldTransformBackground) {
      applyBackgroundTransformation(scene, isIsometric, shouldTransformBackground);
  }
});

// Aplica a perspectiva isométrica quando a cena termina de ser renderizada
Hooks.on("gridConfigUpdate", (event) => {
  const scene = canvas.scene;
  if (!scene) return;
  
  const isIsometric = scene.getFlag(MODULE_ID, "isometricEnabled");
  const shouldTransformBackground = scene.getFlag(MODULE_ID, "isometricBackground") ?? false;
  
  // Re-apply isometric transformations after grid update
  if (isIsometric) {
    requestAnimationFrame(() => {
      applyIsometricPerspective(scene, isIsometric);
      applyBackgroundTransformation(scene, isIsometric, shouldTransformBackground);
    });
  }
});

Hooks.on("closeGridConfig", (app) => {
  const scene = app.object;
  if (!scene) return;
  
  const isIsometric = scene.getFlag(MODULE_ID, "isometricEnabled");
  const isometricWorldEnabled = game.settings.get(MODULE_ID, "worldIsometricFlag");
  const shouldTransformBackground = scene.getFlag(MODULE_ID, "isometricBackground") ?? false;
  
  if (isometricWorldEnabled && isIsometric) {
      requestAnimationFrame(() => {
          applyIsometricPerspective(scene, isIsometric);
          applyBackgroundTransformation(scene, isIsometric, shouldTransformBackground);
      });
  }
});


// Adicione um hook para atualizar background, tokens e tiles quando a cena for modificada
Hooks.on("updateScene", (scene, changes) => {
  if (changes.img || 
      changes.background?.offsetX !== undefined || 
      changes.background?.offsetY !== undefined ||
      changes.flags?.[MODULE_ID]?.isometricEnabled !== undefined ||
      changes.flags?.[MODULE_ID]?.isometricBackground !== undefined ||
      changes.grid !== undefined ||          // Verifica mudanças na grid
      changes.gridType !== undefined ||      // Verifica mudanças no tipo de grid
      changes.gridSize !== undefined) {      // Verifica mudanças no tamanho da grid
      
      const isIsometric = scene.getFlag(MODULE_ID, "isometricEnabled");
      const shouldTransformBackground = scene.getFlag(MODULE_ID, "isometricBackground") ?? false;
      
      if (game.settings.get(MODULE_ID, "debug")) {
          console.log("Scene update detected, reapplying isometric transformations");
      }
      
      requestAnimationFrame(() => {
          applyIsometricPerspective(scene, isIsometric);
          applyBackgroundTransformation(scene, isIsometric, shouldTransformBackground);
      });
  }
});

// -------- HOOKS TOKENS -----------------------------------------------------------------------------------------------------------
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


// -------- HOOKS TILES ------------------------------------------------------------------------------------------------------------
// Hooks para Tiles
Hooks.on("createTile", (tileDocument) => {
  const tile = canvas.tiles.get(tileDocument.id);
  if (!tile) return;
  
  const scene = tile.scene;
  const isIsometric = scene.getFlag(MODULE_ID, "isometricEnabled");
  requestAnimationFrame(() => applyIsometricTransformation(tile, isIsometric));
});

Hooks.on("updateTile", (tileDocument, updateData, options, userId) => {
  const tile = canvas.tiles.get(tileDocument.id);
  if (!tile) return;
  
  const scene = tile.scene;
  const isIsometric = scene.getFlag(MODULE_ID, "isometricEnabled");
  
  if (updateData.x !== undefined || updateData.y !== undefined || 
      updateData.width !== undefined || updateData.height !== undefined ||
      updateData.texture !== undefined) {
    requestAnimationFrame(() => applyIsometricTransformation(tile, isIsometric));
  }
});

Hooks.on("refreshTile", (tile) => {
  const scene = tile.scene;
  const isIsometric = scene.getFlag(MODULE_ID, "isometricEnabled");
  applyIsometricTransformation(tile, isIsometric);
});











// -------- FUNÇÕES AUXILIARES -----------------------------------------------------------------------------------------------------
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










// -------- MEU TOKEN HUD ----------------------------------------------------------------------------------------------------------
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






// -------- FUNÇÕES TRANSFORMAÇÃO ISOMÉTRICA ---------------------------------------------------------------------------------------
// Função principal que muda o canvas da cena
function applyIsometricPerspective(scene, isIsometric) {
  //console.log("applyIsometricPerspective", scene);
  const isometricWorldEnabled = game.settings.get(MODULE_ID, "worldIsometricFlag");
  const isoAngle = Math.PI/6;
  
  if (isometricWorldEnabled && isIsometric) {
    canvas.app.stage.rotation = -isoAngle;
    canvas.app.stage.skew.set(isoAngle, 0);
    adjustAllTokensAndTilesForIsometric();
    
    // Aplica transformação no background se estiver habilitado
    //const shouldTransformBackground = scene.getFlag(MODULE_ID, "isometricBackground") ?? false;
    //applyBackgroundTransformation(scene, isIsometric, shouldTransformBackground);
    
  } else {
    canvas.app.stage.rotation = 0;
    canvas.app.stage.skew.set(0, 0);
    //applyBackgroundTransformation(scene, false, false);
  }
}

// Função auxiliar que chama a função de transformação isométrica em todos os tokens e tiles da cena
function adjustAllTokensAndTilesForIsometric() {
  canvas.tokens.placeables.forEach(token => applyIsometricTransformation(token, true));
  canvas.tiles.placeables.forEach(tile => applyIsometricTransformation(tile, true));
}

// Função auxiliar que chama a função de transformação isométrica em um objeto específico da cena (token ou tile)
function applyTokenTransformation(token, isIsometric) {
  applyIsometricTransformation(token, isIsometric);
}

// Função que aplica a transformação isométrica para um token ou tile -------------------------------------------------
function applyIsometricTransformation(object, isIsometric) {
  const isometricWorldEnabled = game.settings.get(MODULE_ID, "worldIsometricFlag");
  
  if (!object.mesh) {
    if (game.settings.get(MODULE_ID, "debug")) {
      console.warn("Mesh não encontrado:", object);
    }
    return;
  }

  if (isometricWorldEnabled && isIsometric) {
    object.mesh.rotation = Math.PI/4;
    object.mesh.skew.set(0, 0);
    
    const texture = object.texture;
    const originalWidth = texture.width;
    const originalHeight = texture.height;
    let ratio = originalWidth / originalHeight;

    // Se o objeto for um Token
    if (object instanceof Token) {
      const tokenScale = object.document.texture;
      const tokenDimW = object.document.width;
      const tokenDimH = object.document.height;
      const isoScale = object.document.getFlag(MODULE_ID, 'scale') ?? 1;
      
      object.mesh.scale.set(
        tokenScale.scaleX * tokenDimH * ratio * isoScale,
        tokenScale.scaleY * tokenDimW * isoScale
      );
      
      const offsetX = object.document.getFlag(MODULE_ID, 'offsetY') ?? 0;
      const offsetY = object.document.getFlag(MODULE_ID, 'offsetX') ?? 0;
      
      const isoOffsets = cartesianToIso(offsetX, offsetY);
      object.mesh.position.set(
        object.document.x + isoOffsets.x,
        object.document.y + isoOffsets.y
      );
    } 
    // Se o objeto for um Tile
    else if (object instanceof Tile) {
      const tileScale = object.document.texture;
      const tileDimW = object.document.width;
      const tileDimH = object.document.height;
      const isoScale = object.document.getFlag(MODULE_ID, 'scale') ?? 1;
      const reverseTransform = object.document.getFlag(MODULE_ID, 'reverseTransform') ?? true;
      
      if (reverseTransform) {
        // Calcular a largura base como a distância horizontal entre os vértices
        const baseWidth = tileDimW * Math.cos(Math.PI/4);
        
        // Aplicar a escala mantendo a proporção da arte original
        object.mesh.scale.set(
          tileScale.scaleX * baseWidth * ratio * isoScale,
          tileScale.scaleY * tileDimH * isoScale
        );
      } else {
        // Quando não reverter a transformação, aplica apenas rotação e escala básica
        object.mesh.scale.set(
          tileScale.scaleX * tileDimW * isoScale,
          tileScale.scaleY * tileDimH * isoScale
        );
      }

      // Aplicar a posição base do tile
      object.mesh.position.set(
        object.document.x,
        object.document.y
      );
    }
  } else {
    // Reseta todas as transformações do mesh
    object.mesh.rotation = 0;
    object.mesh.skew.set(0, 0);
    object.mesh.scale.set(1, 1);
    object.mesh.position.set(object.document.x, object.document.y);
  }
}

// Função para transformar o background da cena -----------------------------------------------------------------------
function applyBackgroundTransformation(scene, isIsometric, shouldTransform) {
  if (!canvas?.primary?.background) {
    if (game.settings.get(MODULE_ID, "debug")) {
      console.warn("Background não encontrado");
    }
    return;
  }

  const background = canvas.environment.primary.background;
  const isometricWorldEnabled = game.settings.get(MODULE_ID, "worldIsometricFlag");
  
  if (isometricWorldEnabled && isIsometric && shouldTransform) {
    // Aplica rotação isométrica
    background.rotation = Math.PI/4;
    background.skew.set(0, 0);
    background.anchor.set(0.5, 0.5);
    background.transform.scale.set(2, 2 * Math.sqrt(3));
    
    // Calculate scene dimensions and padding
    const s = canvas.scene;
    //console.log(s);
    const padding = s.padding;
    const paddingX = s.width * padding;
    const paddingY = s.height * padding;
      
    // Account for background offset settings
    const offsetX = s.background.offsetX || 0;
    const offsetY = s.background.offsetY || 0;
    
    // Set position considering padding and offset
    background.position.set(
        (s.width / 2) + paddingX,
        (s.height / 2) + paddingY
    );
    
    // Handle foreground if it exists
    if (canvas.environment.primary.foreground) {
      const foreground = canvas.environment.primary.foreground;
      foreground.anchor.set(0.5, 0.5);
      foreground.transform.scale.set(1, 1);
      foreground.transform.setFromMatrix(canvas.stage.transform.worldTransform.invert());
      foreground.position.set(
        (s.width / 2) + paddingX + (s.foreground?.offsetX || 0),
        (s.height / 2) + paddingY + (s.foreground?.offsetY || 0)
      );
    }

    if (game.settings.get(MODULE_ID, "debug")) {
      console.log("Background transformation done.");
    }

  } else {
    // Reset transformações
    background.rotation = 0;
    background.skew.set(0, 0);
    //background.anchor.set(0.5, 0.5);
    //background.scale.set(1, 1);
    //background.transform.position.set(canvas.scene.width/2, canvas.scene.height/2);
    
    if (game.settings.get(MODULE_ID, "debug")) {
      console.log("Background transformation reset");
    }
  }
}