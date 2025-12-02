const fs = require("fs");
const path = require("path");
const axios = require("axios");
const {
  templates,
  enviarMensajeTexto,
  enviarPlantillaOfertas,
  enviarPlantillaMenuInicio,
  enviarPlantillaMenuHoy,
  enviarPlantillaUbicacionHorario,
  enviarPlantillaPedido,
  enviarPlantillaPedidoDirecto,
  enviarPlantillaPagoDeposito,
  enviarPayload,
} = require("./whatsappTemplates");

const accessToken = "EAAa6SbXtAUYBP2yZBqrFwLWFc6U8J7ZBK16gC7T3ae1nRAhiWvj8gjDhW315dx8WJKrA01CBwY5qFIO6mbqD9bSUW6kjUSYxccSEFtpW36GSjMsqKaRqIExfzZBUWWB2Kh3UNxj9cPBR6SHqPx4cevqTCjywilOa7Nffvkkjm43h1y1mydZBypWsboaFAAZDZD";
const phoneNumberId = "779293688610562";
const API_HOST = process.env.API_HOST || '192.168.0.8';

async function registrarPedidoEnAPI(numeroWhatsApp, datosPedido) {
  try {
    const productos = [
      {
        id: datosPedido.platilloId,
        nombre: datosPedido.platilloNombre,
        precio: datosPedido.platilloPrecio,
        cantidad: 1
      }
    ];
    
    // Preparar el payload para la API PHP
    const payload = {
      numero_whatsapp: numeroWhatsApp,
      nombre: datosPedido.nombre || '',
      direccion: datosPedido.ubicacion || datosPedido.direccion || '',
      tipo_entrega: datosPedido.tipoEntrega || 'recoger',
      productos: productos,
      total: datosPedido.platilloPrecio,
      notas: datosPedido.notas || ''
    };
        
    // Enviar a tu API PHP
    const response = await fetch(`http://${API_HOST}/whats/api.php/pedido`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }
    
    const data = await response.json();

    return {
      success: true,
      data: data,
      pedidoId: data.pedido_id || data.pedidoId
    };
    
  } catch (error) {
    console.error('Err en la API:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

const sessions = {};

function getSession(phone) {
  if (!sessions[phone]) {
    sessions[phone] = {
      step: 'idle',
      data: {},
      timestamp: Date.now(),
      attempts: 0
    };
  }
  
  // Limpiar sesiones antiguas
  if (Date.now() - sessions[phone].timestamp > 30 * 60 * 1000) {
    delete sessions[phone];
    return getSession(phone);
  }
  
  return sessions[phone];
}

function updateSession(phone, updates) {
  const session = getSession(phone);
  Object.assign(session, updates);
  session.timestamp = Date.now();
  return session;
}

function clearSession(phone) {
  delete sessions[phone];
}

async function validarPlatilloConAPI(nombrePlatillo) {
  try {    
    const response = await fetch(`http://${API_HOST}/whats/api.php/validar-platillo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ nombre: nombrePlatillo })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
    
  } catch (error) {
    console.error(`Err validando platillo "${nombrePlatillo}":`, error.message);
    return { 
      existe: false, 
      error: "No se pudo conectar al servidor",
      sugerencias: []
    };
  }
}

async function pedirPlatilloPorTexto(to, mensaje) {
  try {
    await enviarMensajeTexto(to, mensaje);
  } catch (error) {
    console.error("Err pidiendo platillo:", error.message);
    await enviarPlantillaPedidoDirecto(to, mensaje);
  }
}

async function mostrarOpcionesDePago(to, platillo, precio, tipoEntrega, nombreCliente = '', ubicacion = '') {
  try {
    let mensaje = `*RESUMEN DEL PEDIDO*\n\n`;
    
    if (nombreCliente) {
      mensaje += `*Nombre:* ${nombreCliente}\n`;
    }
    
    mensaje += `*Platillo:* ${platillo}\n`;
    mensaje += `*Precio:* $${precio}\n`;
    
    if (tipoEntrega === 'domicilio' && ubicacion) {
      mensaje += `*Entrega a:* ${ubicacion}\n`;
    } else {
      mensaje += `*Para recoger en local*\n`;
    }
    
    mensaje += `*SELECCIONA MÉTODO DE PAGO:*\n\n`;
    mensaje += `1. EFECTIVO - Paga al recibir\n`;
    mensaje += `2. DEPÓSITO - Te enviaremos datos bancarios\n`;
    mensaje += `3. CANCELAR\n\n`;

    // SOLO UN ENVÍO
    await enviarMensajeTexto(to, mensaje);
    
  } catch (error) {
    console.error("Err mostrando opciones de pago:", error.message);
  }
}

async function mostrarConfirmacionPedido(to, datosPedido) {
  let mensaje = `*Resumen final*\n\n`;
  
  if (datosPedido.nombre) {
    mensaje += `*Cliente:* ${datosPedido.nombre}\n`;
  }
  
  mensaje += `*Platillo:* ${datosPedido.platilloNombre}\n`;
  mensaje += `*Precio:* $${datosPedido.platilloPrecio}\n`;
  
  if (datosPedido.tipoEntrega === 'domicilio' && datosPedido.ubicacion) {
    mensaje += `*Entrega a:* ${datosPedido.ubicacion}\n`;
  } else {
    mensaje += `*Recoger en local*\n`;
  }
  
  mensaje += `*Metodo de pago:* ${datosPedido.metodoPago === 'efectivo' ? 'Efectivo' : 'Depósito/Transferencia'}\n\n`;
  mensaje += `¿Confirmar pedido?`;
  
  await enviarMensajeTexto(to, mensaje);
  
  const components = [
    {
      type: "body",
      parameters: []
    },
    {
      type: "button",
      sub_type: "quick_reply",
      index: "0",
      parameters: [
        {
          type: "payload",
          payload: "confirmar_pedido_final"
        }
      ]
    },
    {
      type: "button",
      sub_type: "quick_reply",
      index: "1",
      parameters: [
        {
          type: "payload",
          payload: "cancelar_pedido"
        }
      ]
    }
  ];
  
  try {
    await enviarPayload(to, "pedido_recoger", components);
  } catch (error) {
    console.error("Err enviando confirmación:", error.message);
    await enviarMensajeTexto(to, "Responde:\n Confirmar\n Cancelar");
  }
}

async function finalizarPedido(to, datosPedido) {
  try {
    const resultadoAPI = await registrarPedidoEnAPI(to, datosPedido);
    
    if (resultadoAPI.success) {
      const mensajeFinal = `*Pedido confirmado*\n\n` +
        `  *Detalles del pedido:*\n` +
        `*Cliente:* ${datosPedido.nombre || 'Cliente'}\n` +
        `*Platillo:* ${datosPedido.platilloNombre}\n` +
        `*Precio:* $${datosPedido.platilloPrecio}\n` +
        `*${datosPedido.tipoEntrega === 'recoger' ? 'Recoger en local' : 'Entrega a domicilio'}*\n` +
        `*Pago:* ${datosPedido.metodoPago === 'efectivo' ? 'Efectivo' : 'Depósito/Transferencia'}\n\n` +
        `*Numero de pedido:* ${resultadoAPI.pedidoId || 'Generado'}\n` +
        `Te contactaremos cuando validemos tu pedido.`;
      
      await enviarMensajeTexto(to, mensajeFinal);
    } else {
      const mensajeFallback = `*Pedido confirmado*\n\n` +
        `*Detalles del pedido:*\n` +
        `*Cliente:* ${datosPedido.nombre || 'Cliente'}\n` +
        `*Platillo:* ${datosPedido.platilloNombre}\n` +
        `*Precio:* $${datosPedido.platilloPrecio}\n` +
        `*${datosPedido.tipoEntrega === 'recoger' ? 'Recoger en local' : 'Entrega a domicilio'}*\n` +
        `*Pago:* ${datosPedido.metodoPago === 'efectivo' ? 'Efectivo' : 'Depósito/Transferencia'}\n\n` +
        `Te contactaremos cuando validemos tu pedido.`;
      
      await enviarMensajeTexto(to, mensajeFallback);
      console.warn("err al registrar en la API:", resultadoAPI.error);
    }
    
  } catch (error) {
    console.error("Err finalizando pr:", error.message);
    await enviarMensajeTexto(to, "Pedido recibido. Te contactaremos cuando validemos tu pedido.");
  }
}

async function handleIncomingMessage(payload) {
  fs.appendFileSync(
    "debug_post_log.txt",
    `${new Date().toISOString()} - POST Request completo:\n${JSON.stringify(payload, null, 2)}\n\n`
  );

  const firstEntry = payload.entry?.[0];
  const firstChange = firstEntry?.changes?.[0];
  const firstMessage = firstChange?.value?.messages?.[0];

  if (!firstMessage) {
    return;
  }

  const message = firstMessage;
  console.log("Mensaje Recibido:", JSON.stringify(message, null, 2));

  const from = message.from;
  console.log(`De: ${from}`);
  
  const session = getSession(from);
  console.log(`Estado sesión: ${session.step}`);

  // Manejo de texto
  if (message.type === "text") {
    const body = message.text?.body || "";
    console.log(`Texto recibido: "${body}"`);
    
    const bodyLower = body.toLowerCase().trim();

    // Validar si esta en el flujo de pedido
    if (session.step && (session.step.includes('awaiting_plate') || session.step === 'awaiting_location' || session.step === 'awaiting_name' || session.step === 'plate_validated' || session.step === 'payment_selected')) {
      console.log(`Usuario en flujo de pedido (paso: ${session.step})`);
      
      // Si está esperando platillo para recoger
      if (session.step === 'awaiting_plate_pickup') {
        const validacion = await validarPlatilloConAPI(body);
        
        if (validacion.existe && validacion.platillos && validacion.platillos.length > 0) {
          const platillo = validacion.platillos[0];
          console.log(`Platillo válido: ${platillo.nombre} - $${platillo.precio}`);
          
          updateSession(from, {
            step: 'awaiting_name',
            data: {
              platillo: platillo,
              platilloId: platillo.id,
              platilloNombre: platillo.nombre,
              platilloDescripcion: platillo.descripcion,
              platilloPrecio: platillo.precio,
              tipoEntrega: 'recoger'
            },
            attempts: 0
          });
          
          await enviarMensajeTexto(
            from, 
            `*${platillo.nombre}* seleccionado - $${platillo.precio}\n\n` +
            `*¿Cuál es tu nombre para el pedido?*`
          );
          
        } else {
          console.log(`Platillo no encontrado: "${body}"`);
          session.attempts = (session.attempts || 0) + 1;
          
          let mensajeError = `*"${body}"* no está en nuestro menú.\n\n`;
          
          if (validacion.sugerencias && validacion.sugerencias.length > 0) {
            mensajeError += "*Productos similares*\n";
            validacion.sugerencias.slice(0, 3).forEach((sug, index) => {
              mensajeError += `${index + 1}. ${sug.nombre} - $${sug.precio}\n`;
            });
            mensajeError += "\n *Escribe el producto exacto:*";
          } else {
            try {
              const response = await fetch(`http://${API_HOST}/whats/api.php/menu`);
              const data = await response.json();
              
              if (data.menu && data.menu.length > 0) {
                mensajeError += "*Nuestro menú incluye:*\n";
                data.menu.slice(0, 4).forEach((item, index) => {
                  mensajeError += `${index + 1}. ${item.nombre}\n`;
                });
                mensajeError += "\n *Escribe el nombre exacto:*";
              }
            } catch (e) {
              mensajeError += " *Por favor escribe el nombre exacto del platillo:*";
            }
          }
          
          if (session.attempts >= 2) {
            mensajeError += "\n\n *Consejo:* Escribe 'menu' para ver las opciones.";
          }
          
          await pedirPlatilloPorTexto(from, mensajeError);
        }
        
        return;
      }
      
      // platillo para domicilio
      if (session.step === 'awaiting_plate_delivery') {
        const validacion = await validarPlatilloConAPI(body);
        
        if (validacion.existe && validacion.platillos && validacion.platillos.length > 0) {
          const platillo = validacion.platillos[0];
          console.log(`Platillo válido: ${platillo.nombre} - $${platillo.precio}`);
          
          updateSession(from, {
            step: 'awaiting_location',
            data: {
              platillo: platillo,
              platilloId: platillo.id,
              platilloNombre: platillo.nombre,
              platilloDescripcion: platillo.descripcion,
              platilloPrecio: platillo.precio,
              tipoEntrega: 'domicilio'
            },
            attempts: 0
          });
          
          await enviarMensajeTexto(
            from, 
            `*${platillo.nombre}* seleccionado - $${platillo.precio}\n\n` +
            `*Por favor envia tu direccion para la entrega:*\n` +
            `(Calle, número, colonia, ciudad, referencias)`
          );
          
        } else {
          console.log(`Platillo no encontrado: "${body}"`);
          session.attempts = (session.attempts || 0) + 1;
          
          let mensajeError = `*"${body}"* no está en nuestro menu.\n\n`;
          
          if (validacion.sugerencias && validacion.sugerencias.length > 0) {
            mensajeError += "*Productos similares*\n";
            validacion.sugerencias.slice(0, 3).forEach((sug, index) => {
              mensajeError += `${index + 1}. ${sug.nombre} - $${sug.precio}\n`;
            });
            mensajeError += "\n *Escribe el producto exacto:*";
          } else {
            try {
              const response = await fetch(`http://${API_HOST}/whats/api.php/menu`);
              const data = await response.json();
              
              if (data.menu && data.menu.length > 0) {
                mensajeError += "*Nuestro menú incluye:*\n";
                data.menu.slice(0, 4).forEach((item, index) => {
                  mensajeError += `${index + 1}. ${item.nombre}\n`;
                });
                mensajeError += "\n *Escribe el nombre exacto:*";
              }
            } catch (e) {
              mensajeError += " *Por favor escribe el nombre exacto del platillo:*";
            }
          }
          
          if (session.attempts >= 2) {
            mensajeError += "\n\n *Consejo:* Escribe 'menu' para ver las opciones.";
          }
          
          await pedirPlatilloPorTexto(from, mensajeError);
        }
        
        return;
      }
      
      // ubicación para domicilio
      if (session.step === 'awaiting_location' && session.data.tipoEntrega === 'domicilio') {
        console.log(`Ubicación recibida: "${body}"`);
        
        updateSession(from, {
          step: 'awaiting_name',
          data: {
            ...session.data,
            ubicacion: body,
            direccion: body
          }
        });
        
        await enviarMensajeTexto(
          from, 
          `*Dirección registrada:*\n${body}\n\n` +
          `*¿Cuál es tu nombre para el pedido?*`
        );
        return;
      }
      
      // Si está esperando nombre del cliente
      if (session.step === 'awaiting_name') {
        console.log(`Nombre recibido: "${body}"`);
        
        updateSession(from, {
          step: 'plate_validated',
          data: {
            ...session.data,
            nombre: body
          }
        });
        
        await mostrarOpcionesDePago(
          from, 
          session.data.platilloNombre, 
          session.data.platilloPrecio, 
          session.data.tipoEntrega,
          body,
          session.data.ubicacion || ''
        );
        return;
      }

      //Pago seleccionado
      if (session.step === 'plate_validated') {
        
        if (bodyLower.includes("efectivo") || bodyLower.includes("cash") || bodyLower === "efectivo") {
          console.log("Pago en efectivo seleccionado por texto");
          updateSession(from, {
            step: 'payment_selected',
            data: {
              ...session.data,
              metodoPago: 'efectivo'
            }
          });
          
          await mostrarConfirmacionPedido(from, session.data);
          return;
        }
        
        if (bodyLower.includes("deposito") || bodyLower.includes("transferencia") || bodyLower.includes("banco") || bodyLower === "depósito") {
          console.log("Pago por depósito seleccionado por texto");
          updateSession(from, {
            step: 'payment_selected',
            data: {
              ...session.data,
              metodoPago: 'deposito'
            }
          });
          
          await enviarPlantillaPagoDeposito(
            from, 
            "BBVA", 
            "Los Pollos Hermanos SA de CV", 
            "012180001234567890"
          );
          
          setTimeout(async () => {
            await enviarMensajeTexto(
              from,
              "¿Deseas confirmar el pedido con pago por depósito?\n\nResponde:\n Sí\n No"
            );
          }, 2000);
          return;
        }
        
        if (bodyLower.includes("cancelar") || bodyLower === "no") {
          console.log("Cancelación por texto");
          clearSession(from);
          await enviarMensajeTexto(from, "Pedido cancelado.");
          return;
        }
        
        await enviarMensajeTexto(
          from,
          `Por favor selecciona una opcion:\n\n` +
          `*Efectivo*\n` +
          `*Depósito/Transferencia*\n` +
          `*Cancelar*`
        );
        return;
      }
      
      // Si está en estado payment_selected y escribe confirmación
      if (session.step === 'payment_selected') {
        
        if (bodyLower.includes("si") || bodyLower.includes("sí") || bodyLower.includes("confirmar") || bodyLower === "ok") {
          console.log("Confirmado");
          
          await finalizarPedido(from, session.data);
          clearSession(from);
          return;
        }
        
        if (bodyLower.includes("no") || bodyLower.includes("cancelar")) {
          console.log("Cancelado");
          clearSession(from);
          await enviarMensajeTexto(from, "Pedido cancelado.");
          return;
        }
        
        await enviarMensajeTexto(
          from,
          `¿Confirmas el pedido?\n\n` +
          `*Sí* - Confirmar pedido\n` +
          `*No* - Cancelar pedido`
        );
        return;
      }
    }
    
    // Comandos generales
    if (bodyLower.includes("hola") || bodyLower.includes("menu") || bodyLower.includes("inicio") || bodyLower.includes("start")) {
      clearSession(from);
      try {
        await enviarPlantillaMenuInicio(from);
      } catch (error) {
        console.error("Error enviando menú de inicio:", error.message);
      }
    }
    else if (bodyLower.includes("ver ofertas") || bodyLower.includes("ofertas") || bodyLower.includes("promociones") || bodyLower.includes("promo")) {
      console.log("Solicitando ofertas para:", from);
      try {
        await enviarPlantillaOfertas(from, "válido solo hoy y mañana");
        console.log("Ofertas enviada");
      } catch (error) {
        console.error("Error enviando ofertas:", error.message);
      }
    }
    else if (bodyLower.includes("menu hoy") || bodyLower.includes("menú de hoy") || bodyLower.includes("ver menu") || bodyLower.includes("carta")) {
      console.log("Solicitando menú de hoy para:", from);
      try {
        await enviarPlantillaMenuHoy(from);
        console.log("Menú de hoy enviado");
      } catch (error) {
        console.error("Error enviando menú de hoy:", error.message);
      }
    }
    else if (bodyLower.includes("ubicacion") || bodyLower.includes("ubicación") || bodyLower.includes("horarios") || bodyLower.includes("dirección") || bodyLower.includes("donde")) {
      console.log("Solicitando ubicación/horarios para:", from);
      try {
        await enviarPlantillaUbicacionHorario(from);
        console.log("Ubicación/horarios enviados");
      } catch (error) {
        console.error("Error enviando ubicación:", error.message);
      }
    }
    else if (bodyLower.includes("pedido") || bodyLower.includes("ordenar") || bodyLower.includes("comprar") || bodyLower.includes("quiero")) {
      console.log("Solicitando hacer pedido para:", from);
      clearSession(from);
      try {
        await enviarPlantillaPedido(from);
        console.log("Plantilla de pedido enviada");
      } catch (error) {
        console.error("Error enviando plantilla de pedido:", error.message);
      }
    }
    else if (bodyLower.includes("pago") || bodyLower.includes("deposito") || bodyLower.includes("transferencia") || bodyLower.includes("cuenta")) {
      try {
        await enviarPlantillaPagoDeposito(
          from, 
          "BBVA", 
          "Los Pollos Hermanos SA de CV", 
          "012180001234567890"
        );
        console.log("Datos de pago enviados");
      } catch (error) {
        console.error("Error enviando datos de pago:", error.message);
      }
    }
    else if (bodyLower.includes("cancelar") || bodyLower.includes("salir")) {
      console.log("Cancelando pedido...");
      clearSession(from);
      await enviarMensajeTexto(from, "Pedido cancelado.");
    }
    else {
      console.log("Mensaje no reconocido");
      try {
        await enviarPlantillaMenuInicio(from);
      } catch (error) {
        console.error("Err enviando menu:", error.message);
      }
    }
  }

  // Manejo de botones
  else if (message.type === "button" && message.button) {
    const buttonPayload = message.button.payload;
    const buttonText = message.button.text || buttonPayload;
    
    console.log(`Boton:\n  Texto: "${buttonText}"\n  Payload: "${buttonPayload}"`);

    const payloadLower = buttonPayload?.toLowerCase() || "";
    
    try {
      switch (payloadLower) {
        case "ver_menu_hoy":
          console.log("Enviando menú de hoy...");
          clearSession(from);
          await enviarPlantillaMenuHoy(from);
          break;
          
        case "ver_ofertas":
          console.log("Enviando ofertas...");
          clearSession(from);
          await enviarPlantillaOfertas(from, "válido solo hoy y mañana");
          break;
          
        case "realizar_pedido":
          console.log("Enviando pedido...");
          clearSession(from);
          await enviarPlantillaPedido(from);
          break;
          
        case "ver_ubicacion_horarios":
          console.log("Enviando ubicación y horarios...");
          clearSession(from);
          await enviarPlantillaUbicacionHorario(from);
          break;
          
        case "regresar_inicio":
          console.log("Regresando al inicio...");
          clearSession(from);
          await enviarPlantillaMenuInicio(from);
          break;
          
        case "para_recoger_local":
          console.log("Pedido para recoger en local...");
          updateSession(from, {
            step: 'awaiting_plate_pickup',
            data: { tipoEntrega: 'recoger' },
            attempts: 0
          });
          await pedirPlatilloPorTexto(
            from, 
            "¿Qué platillo deseas pedir para recoger en el local? Por favor escribe el nombre del platillo."
          );
          break;
          
        case "entrega_domicilio":
          console.log("Pedido a domicilio...");
          updateSession(from, {
            step: 'awaiting_plate_delivery',
            data: { tipoEntrega: 'domicilio' },
            attempts: 0
          });
          await pedirPlatilloPorTexto(
            from, 
            "¿Qué platillo deseas pedir a domicilio? Por favor escribe el nombre del platillo primero."
          );
          break;
          
        case "pago_efectivo":
          console.log("Pago en efectivo seleccionado...");
          const sessionEfectivo = getSession(from);
          
          if (sessionEfectivo.data.platillo) {
            updateSession(from, {
              step: 'payment_selected',
              data: {
                ...sessionEfectivo.data,
                metodoPago: 'efectivo'
              }
            });
            
            await mostrarConfirmacionPedido(from, sessionEfectivo.data);
          } else {
            await enviarMensajeTexto(from, "Pago en efectivo seleccionado\n\nPrimero necesitas seleccionar un platillo.");
          }
          break;
          
        case "pago_deposito":
          console.log("Pago por depósito seleccionado...");
          const sessionDeposito = getSession(from);
          
          if (sessionDeposito.data.platillo) {
            updateSession(from, {
              step: 'payment_selected',
              data: {
                ...sessionDeposito.data,
                metodoPago: 'deposito'
              }
            });
            
            await enviarPlantillaPagoDeposito(
              from, 
              "BBVA", 
              "Los Pollos Hermanos", 
              "012180001234567890"
            );
            
            setTimeout(async () => {
              const components = [
                {
                  type: "body",
                  parameters: []
                },
                {
                  type: "button",
                  sub_type: "quick_reply",
                  index: "0",
                  parameters: [
                    {
                      type: "payload",
                      payload: "confirmar_pedido_final"
                    }
                  ]
                },
                {
                  type: "button",
                  sub_type: "quick_reply",
                  index: "1",
                  parameters: [
                    {
                      type: "payload",
                      payload: "cancelar_pedido"
                    }
                  ]
                }
              ];
              
              await enviarPayload(from, "pedido_recoger", components);
            }, 2000);
          } else {
            await enviarMensajeTexto(from, "Pago por depósito seleccionado\n\nPrimero necesitas seleccionar un platillo.");
          }
          break;
          
        case "confirmar_pedido_final":
          console.log("Confirmando pedido final...");
          const sessionFinal = getSession(from);
          
          if (sessionFinal.data.platillo) {
            await finalizarPedido(from, sessionFinal.data);
            clearSession(from);
          } else {
            await enviarMensajeTexto(from, "No hay un pedido para confirmar. Por favor empieza un nuevo pedido.");
          }
          break;
          
        case "cancelar_pedido":
          console.log("Cancelando pedido...");
          clearSession(from);
          await enviarMensajeTexto(from, "Pedido cancelado.");
          break;
          
        default:
          console.log(`Payload no reconocido: "${buttonPayload}"`);
          clearSession(from);
          await enviarPlantillaMenuInicio(from);
      }
    } catch (error) {
      console.error(`Error procesando botón "${buttonPayload}":`, error.message);
      clearSession(from);
      try {
        await enviarPlantillaMenuInicio(from);
      } catch (error2) {
        console.error("Error en fallback:", error2.message);
      }
    }
  }
    else if (message.type === "interactive" && message.interactive?.type === "button_reply") {
    const buttonText = message.interactive.button_reply?.title;
    console.log(`Botón interactivo: "${buttonText}"`);
    
    try {
      await handleIncomingMessage({
        ...payload,
        entry: [{
          ...firstEntry,
          changes: [{
            ...firstChange,
            value: {
              ...firstChange.value,
              messages: [{
                ...message,
                type: "button",
                button: {
                  text: buttonText,
                  payload: buttonText
                }
              }]
            }
          }]
        }]
      });
    } catch (error) {
      console.error("Error procesando botón interactivo:", error.message);
    }
  }
  
  // Otros tipos de mensajes
  else if (message.type === "image" || message.type === "document") {
    console.log(`${message.type.toUpperCase()} recibido`);
    try {
      await enviarPlantillaMenuInicio(from);
    } catch (error) {
      console.error("Error respondiendo:", error.message);
    }
  }
  else if (message.type === "location") {
    console.log("Ubicación recibida (como archivo)");
    const sessionLoc = getSession(from);
    
    if (sessionLoc.step === 'awaiting_location') {
      updateSession(from, {
        step: 'awaiting_name',
        data: {
          ...sessionLoc.data,
          ubicacion: 'Ubicación recibida por GPS',
          direccion: 'Ubicación recibida por GPS'
        }
      });
      
      await enviarMensajeTexto(
        from, 
        `*Ubicación recibida*\n\n` +
        `*¿Cuál es tu nombre para el pedido?*`
      );
    } else {
      await enviarPlantillaUbicacionHorario(from);
    }
  }
  else {
    console.log(`Tipo de mensaje no manejado: ${message.type}`);
    try {
      await enviarPlantillaMenuInicio(from);
    } catch (error) {
      console.error("Error enviando respuesta:", error.message);
    }
  }
}

module.exports = handleIncomingMessage;