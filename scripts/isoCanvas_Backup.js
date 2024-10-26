/*
To-Do
- Verificar se dentro do hook renderSceneConfig, no bgCheckbox se a parte está correta
    "Verifica se o canvas atual é o canvas que está sendo editado?"
    if (canvas.scene.id === sceneConfig.object.id) {
*/

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
// Modifique o hook renderSceneConfig para incluir o novo checkbox
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
    if (isIsometric === true) {
      await sceneConfig.object.setFlag(MODULE_ID, "isometricEnabled", isIsometric);
    } else {
      await sceneConfig.object.unsetFlag(MODULE_ID, "isometricEnabled");
    }
    applyIsometricPerspective(sceneConfig.object, isIsometric);
  });

  // Handler para o checkbox da transformação do background
  bgCheckbox.on("change", async (event) => {
    const shouldTransform = event.target.checked;
    if (shouldTransform === true) {
      await sceneConfig.object.setFlag(MODULE_ID, "isometricBackground", shouldTransform);
    } else {
      await sceneConfig.object.unsetFlag(MODULE_ID, "isometricBackground");
    }
    const isIsometric = sceneConfig.object.getFlag(MODULE_ID, "isometricEnabled");
    // Verifica se o canvas atual é o canvas que está sendo editado?
    // FALTA VERIFICAR SE ISSO ESTÁ CORRETO
    if (canvas.scene.id === sceneConfig.object.id) {
      applyIsometricPerspective(sceneConfig.object, isIsometric);
    }
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
/*
// Funções auxiliares para cálculos comuns
function getTextureRatio(texture) {
  return texture.width / texture.height;
}

function resetMeshTransformation(mesh, x, y) {
  mesh.rotation = 0;
  mesh.skew.set(0, 0);
  mesh.scale.set(1, 1);
  mesh.position.set(x, y);
}

function applyBasicIsometricTransformation(mesh) {
  mesh.rotation = Math.PI/4;
  mesh.skew.set(0, 0);
}

// Funções específicas para transformação de tokens
function calculateTokenScale(token, ratio, isoScale = 1) {
  const tokenScale = token.document.texture;
  const tokenDimW = token.document.width;
  const tokenDimH = token.document.height;

  return {
    x: tokenScale.scaleX * tokenDimH * ratio * isoScale,
    y: tokenScale.scaleY * tokenDimW * isoScale
  };
}

function calculateTokenPosition(token) {
  // Os offsets estão trocados intencionalmente para corrigir o movimento
  const offsetX = token.document.getFlag(MODULE_ID, 'offsetY') ?? 0;
  const offsetY = token.document.getFlag(MODULE_ID, 'offsetX') ?? 0;
  
  const isoOffsets = cartesianToIso(offsetX, offsetY);
  return {
    x: token.document.x + isoOffsets.x,
    y: token.document.y + isoOffsets.y
  };
}

function applyTokenIsometricTransformation(token) {
  const ratio = getTextureRatio(token.texture);
  const isoScale = token.document.getFlag(MODULE_ID, 'scale') ?? 1;
  
  // Aplica transformações básicas
  applyBasicIsometricTransformation(token.mesh);
  
  // Aplica escala
  const scale = calculateTokenScale(token, ratio, isoScale);
  token.mesh.scale.set(scale.x, scale.y);
  
  // Aplica posição
  const position = calculateTokenPosition(token);
  token.mesh.position.set(position.x, position.y);
}

// Funções específicas para transformação de tiles
function calculateTileScale(tile, ratio, isoScale = 1) {
  const tileScale = tile.document.texture;
  const tileDimW = tile.document.width;
  const tileDimH = tile.document.height;
  const reverseTransform = tile.document.getFlag(MODULE_ID, 'reverseTransform') ?? true;

  if (reverseTransform) {
    // Calcula a largura base como a distância horizontal entre os vértices
    const baseWidth = tileDimW * Math.cos(Math.PI/4);
    return {
      x: tileScale.scaleX * baseWidth * ratio * isoScale,
      y: tileScale.scaleY * tileDimH * isoScale
    };
  } else {
    return {
      x: tileScale.scaleX * tileDimW * isoScale,
      y: tileScale.scaleY * tileDimH * isoScale
    };
  }
}

function applyTileIsometricTransformation(tile) {
  const ratio = getTextureRatio(tile.texture);
  const isoScale = tile.document.getFlag(MODULE_ID, 'scale') ?? 1;
  
  // Aplica transformações básicas
  applyBasicIsometricTransformation(tile.mesh);
  
  // Aplica escala
  const scale = calculateTileScale(tile, ratio, isoScale);
  tile.mesh.scale.set(scale.x, scale.y);
  
  // Aplica posição base do tile
  tile.mesh.position.set(tile.document.x, tile.document.y);
}

// Função principal de transformação
function applyIsometricTransformation(object, isIsometric) {
  const isometricWorldEnabled = game.settings.get(MODULE_ID, "worldIsometricFlag");
  
  if (!object.mesh) {
    if (game.settings.get(MODULE_ID, "debug")) {
      console.warn("Mesh não encontrado:", object);
    }
    return;
  }

  if (isometricWorldEnabled && isIsometric) {
    if (object instanceof Token) {
      applyTokenIsometricTransformation(object);
    } else if (object instanceof Tile) {
      applyTileIsometricTransformation(object);
    }
  } else {
    resetMeshTransformation(object.mesh, object.document.x, object.document.y);
  }
}
*/

// Função para ajustar o posicionamento isométrico
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
      const isoScale = object.document.getFlag(MODULE_ID, 'scale') ?? 0.01;
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

















// Modifique a função applyIsometricPerspective para incluir a transformação do background
function applyIsometricPerspective(scene, isIsometric) {
  console.log("applyIsometricPerspective", scene);
  const isometricWorldEnabled = game.settings.get(MODULE_ID, "worldIsometricFlag");
  const isoAngle = Math.PI/6;
  
  if (isometricWorldEnabled && isIsometric) {
    canvas.app.stage.rotation = -isoAngle;
    canvas.app.stage.skew.set(isoAngle, 0);
    
    // Aplica transformação no background se estiver habilitado
    //const shouldTransformBackground = scene.getFlag(MODULE_ID, "isometricBackground") ?? false;
    //applyBackgroundTransformation(scene, isIsometric, shouldTransformBackground);
    
    adjustAllTokensForIsometric();
  } else {
    canvas.app.stage.rotation = 0;
    canvas.app.stage.skew.set(0, 0);
    applyBackgroundTransformation(scene, false, false);
  }
}

// Ajusta todos os tokens na cena para visão isométrica
// Atualizar a função adjustAllTokensForIsometric para incluir tiles
function adjustAllTokensForIsometric() {
  canvas.tokens.placeables.forEach(token => applyIsometricTransformation(token, true));
  canvas.tiles.placeables.forEach(tile => applyIsometricTransformation(tile, true));
}

// Substituir a função antiga applyTokenTransformation por esta nova função genérica
function applyTokenTransformation(token, isIsometric) {
  applyIsometricTransformation(token, isIsometric);
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
  const shouldTransformBackground = scene.getFlag(MODULE_ID, "isometricBackground") ?? false;
  applyIsometricPerspective(scene, isIsometric);
  applyBackgroundTransformation(scene, isIsometric, shouldTransformBackground);
});




// -------------- HOOKS TILES ---------------------------------------

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

// Adicione um hook para atualizar o background quando a cena for modificada
Hooks.on("updateScene", (scene, changes) => {
  if (changes.img || 
      changes.background?.offsetX !== undefined || 
      changes.background?.offsetY !== undefined ||
      changes.flags?.[MODULE_ID]?.isometricEnabled !== undefined ||
      changes.flags?.[MODULE_ID]?.isometricBackground !== undefined) {
      
      const isIsometric = scene.getFlag(MODULE_ID, "isometricEnabled");
      const shouldTransformBackground = scene.getFlag(MODULE_ID, "isometricBackground") ?? false;
      applyBackgroundTransformation(scene, isIsometric, shouldTransformBackground);
  }
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

// Hook para quando um token é adicionado ao canvas
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



// -------------- RENDER TILES ---------------------------------------

// Hook para adicionar a aba de configuração ao tile
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

// -------------- CANVAS HOOKS ---------------------------------------
// Add necessary hooks for background updates
Hooks.on("canvasResize", (canvas) => {
  const scene = canvas.scene;
  if (!scene) return;
  
  const isIsometric = scene.getFlag(MODULE_ID, "isometricEnabled");
  const shouldTransformBackground = scene.getFlag(MODULE_ID, "isometricBackground") ?? false;
  
  if (isIsometric && shouldTransformBackground) {
      applyBackgroundTransformation(scene, isIsometric, shouldTransformBackground);
  }
});











// -------------- BACKGROUND ---------------------------------------
// Função para transformar o background da cena
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
    console.log(s);
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
    
    /*
    // Calcula as dimensões do canvas e da arte
    const canvasWidth = canvas.scene.width;
    const canvasHeight = canvas.scene.height;
    const artWidth = background.texture.width;
    const artHeight = background.texture.height;
    console.log("canvasWidth", canvasWidth, "canvasHeight", canvasHeight);
    
    // Calcula os centros em coordenadas cartesianas
    const canvasCenterX = canvasWidth / 2;
    const canvasCenterY = canvasHeight / 2;
    const artCenterX = artWidth / 2;
    const artCenterY = artHeight / 2;
    console.log("canvasCenterX", canvasCenterX, "canvasCenterY", canvasCenterY);
    console.log("artCenterX", artCenterX, "artCenterY", artCenterY);

    // Converte os centros para coordenadas isométricas
    const isoCanvasCenter = cartesianToIso(canvasCenterX, canvasCenterY);
    const isoArtCenter = cartesianToIso(artCenterX, artCenterY);
    console.log("isoCanvasCenter", isoCanvasCenter, "\nisoArtCenter\n", isoArtCenter);

    // Aplica a transformação de posição usando o transform.position
    background.transform.position.set(canvasCenterX, canvasCenterY);
    */

  } else {
    // Reset transformações
    background.rotation = 0;
    background.skew.set(0, 0);
    //background.anchor.set(0.5, 0.5);
    //background.scale.set(1, 1);
    //background.transform.position.set(canvas.scene.width/2, canvas.scene.height/2);

    // Reset foreground if it exists
    /*
    if (canvas.primary.foreground) {
        const foreground = canvas.primary.foreground;
        foreground.anchor.set(0, 0);
        foreground.transform.scale.set(1, 1);
        foreground.transform.setFromMatrix(new PIXI.Matrix());
        foreground.position.set(0, 0);
    }
    */
    
    if (game.settings.get(MODULE_ID, "debug")) {
      console.log("Background transformation reset");
    }
  }
}


/*
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
    // Set anchor to center for rotation
    background.anchor.set(0.5, 0.5);
    
    // Reset scale and set initial position
    background.transform.scale.set(1, 1);
      
    // Apply inverse transformation to counter the canvas isometric perspective
    background.transform.setFromMatrix(canvas.stage.transform.worldTransform.invert());
      
    // Calculate scene dimensions and padding
    const s = canvas.scene;
    console.log(s);
    const padding = s.padding;
    const paddingX = s.width * padding;
    const paddingY = s.height * padding;
    console.log("paddingX:", paddingX, "paddingY:", paddingY);
      
    // Account for background offset settings
    const offsetX = s.background.offsetX || 0;
    const offsetY = s.background.offsetY || 0;
    console.log("offsetX", offsetX, "offsetY", offsetY);
    console.log("canvas.app.stage.scale.\nscale X:", canvas.app.stage.scale.x, "scale Y:", canvas.app.stage.scale.y);
    
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
      console.log("Background transformation applied:", {
        sceneDimensions: { width: s.width, height: s.height },
        padding: { x: paddingX, y: paddingY },
        offset: { x: offsetX, y: offsetY },
        finalPosition: { 
          x: (s.width / 2) + paddingX + offsetX,
          y: (s.height / 2) + paddingY + offsetY
        }
      });
    }
  } else {
    // Reset transformations
    background.anchor.set(0, 0);
    background.transform.scale.set(1, 1);
    background.transform.setFromMatrix(new PIXI.Matrix());
    background.position.set(0, 0);
      
    // Reset foreground if it exists
    if (canvas.primary.foreground) {
        const foreground = canvas.primary.foreground;
        foreground.anchor.set(0, 0);
        foreground.transform.scale.set(1, 1);
        foreground.transform.setFromMatrix(new PIXI.Matrix());
        foreground.position.set(0, 0);
    }
    
    if (game.settings.get(MODULE_ID, "debug")) {
        console.log("Background transformation reset");
    }
  }
}
*/

/*
function applyBackgroundTransformation(scene, isIsometric, shouldTransform) {
  if (!canvas?.primary?.background) {
    if (game.settings.get(MODULE_ID, "debug")) {
      console.warn("Background não encontrado");
    }
    return;
  }

  const background = canvas.primary.background;
  const isometricWorldEnabled = game.settings.get(MODULE_ID, "worldIsometricFlag");
  
  if (isometricWorldEnabled && isIsometric && shouldTransform) {
    // Aplica rotação isométrica
    background.rotation = Math.PI/4;
    background.skew.set(0, 0);
    
    // Mantém o tamanho original da arte
    background.scale.set(1, 1);
    
    // Calcula o centro do canvas em coordenadas cartesianas
    const canvasCenterX = canvas.scene.width / 2;
    const canvasCenterY = canvas.scene.height / 2;
    
    // Calcula o centro da arte em coordenadas cartesianas
    const artCenterX = background.texture.width / 2;
    const artCenterY = background.texture.height / 2;
    
    // Converte ambos os centros para coordenadas isométricas
    const isoCanvasCenter = cartesianToIso(canvasCenterX, canvasCenterY);
    const isoArtCenter = cartesianToIso(artCenterX, artCenterY);
    
    // Calcula o offset necessário para alinhar os centros
    const offsetX = isoCanvasCenter.x - isoArtCenter.x;
    const offsetY = isoCanvasCenter.y - isoArtCenter.y;
    
    // Define a posição do background para alinhar os centros
    //background.x = offsetX;
    //background.y = offsetY;

    if (game.settings.get(MODULE_ID, "debug")) {
      console.log("Background transformation applied:", {
        artDimensions: { 
          width: background.texture.width, 
          height: background.texture.height 
        },
        canvasCenter: { x: canvasCenterX, y: canvasCenterY },
        artCenter: { x: artCenterX, y: artCenterY },
        isoCanvasCenter: isoCanvasCenter,
        isoArtCenter: isoArtCenter,
        finalOffset: { x: offsetX, y: offsetY }
      });
    }
  } else {
    // Reset transformações
    background.rotation = 0;
    background.skew.set(0, 0);
    background.scale.set(1, 1);
    background.x = 0;
    background.y = 0;
    
    if (game.settings.get(MODULE_ID, "debug")) {
      console.log("Background transformation reset");
    }
  }
}
*/