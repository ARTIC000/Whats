const axios = require("axios");
const fs = require("fs");

const templates = {
  MENU_HOY: "menu_hoy",
  UBICACION_HORARIO: "ubicacion_horario",
  PAGO_DEPOSITO: "pago_deposito",
  PEDIDO_DOMICILIO: "pedido_domicilio",
  PEDIDO_RECOGER: "pedido_recoger",
  PEDIDO_DIRECTO: "pedido_directo",
  PEDIDO: "pedido",
  OFERTAS: "ofertas", 
  MENU_INICIO: "menu_inicio",
};

function sanitize(text) {
  if (!text) return "";
  const cleaned = text.replace(/[\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
  return cleaned.slice(0, 1024);
}

const accessToken = "EAAa6SbXtAUYBP2yZBqrFwLWFc6U8J7ZBK16gC7T3ae1nRAhiWvj8gjDhW315dx8WJKrA01CBwY5qFIO6mbqD9bSUW6kjUSYxccSEFtpW36GSjMsqKaRqIExfzZBUWWB2Kh3UNxj9cPBR6SHqPx4cevqTCjywilOa7Nffvkkjm43h1y1mydZBypWsboaFAAZDZD";
const phoneNumberId = "779293688610562";

function procesarNumero(to) {
  if (!to) throw new Error("Número de destinatario no válido");
  
  if (to.startsWith("52618")) {
    return to;
  }
  
  if (to.startsWith("521618")) {
    return to.replace(/^521618/, "52618");
  }
  
  return to;
}

async function enviarPayload(to, templateName, components = []) {
  const url = `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`;
  to = procesarNumero(to);

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: "es_MX" },
      components: components.length > 0 ? components : undefined,
    },
  };

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  console.log("Enviando payload:", JSON.stringify(payload, null, 2));

  try {
    const response = await axios.post(url, payload, { headers });
    logExitoso(payload, response.data);
    return response.data;
  } catch (error) {
    logError(payload, error);
    throw error;
  }
}

//Plantillas
async function enviarPlantillaMenuInicio(to) {
  const components = [
    {
      type: "button",
      sub_type: "quick_reply",
      index: "0",
      parameters: [
        {
          type: "payload",
          payload: "ver_menu_hoy"
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
          payload: "ver_ofertas"
        }
      ]
    },
    {
      type: "button",
      sub_type: "quick_reply",
      index: "2",
      parameters: [
        {
          type: "payload",
          payload: "realizar_pedido"
        }
      ]
    },
    {
      type: "button",
      sub_type: "quick_reply",
      index: "3",
      parameters: [
        {
          type: "payload",
          payload: "ver_ubicacion_horarios"
        }
      ]
    }
  ];

  await enviarPayload(to, templates.MENU_INICIO, components);
}

async function enviarPlantillaMenuHoy(to) {
  const components = [
    {
      type: "header",
      parameters: [
        {
          type: "image",
          image: { 
            link: "https://pollofelizsaltillo.com.mx/wp-content/uploads/2025/04/Pollo-Feliz-Saltillo-Promociones-1536x864.jpg"
          }
        }
      ]
    },
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
          payload: "realizar_pedido"
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
          payload: "regresar_inicio"
        }
      ]
    }
  ];

  await enviarPayload(to, templates.MENU_HOY, components);
}

async function enviarPlantillaOfertas(to, promocionTexto = "hoy y mañana") {
  const components = [
    {
      type: "header",
      parameters: [
        {
          type: "image",
          image: { 
            link: "https://pollofelizsaltillo.com.mx/wp-content/uploads/2025/04/Pollo-Feliz-Saltillo-Promociones-1536x864.jpg"
          }
        }
      ]
    },
    {
      type: "body",
      parameters: [
        {
          type: "text",
          text: sanitize(promocionTexto) // {{1}}
        }
      ]
    },
    {
      type: "button",
      sub_type: "quick_reply",
      index: "0",
      parameters: [
        {
          type: "payload",
          payload: "realizar_pedido"
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
          payload: "regresar_inicio"
        }
      ]
    }
  ];

  await enviarPayload(to, templates.OFERTAS, components);
}

async function enviarPlantillaPedido(to) {
  const components = [
    {
      type: "button",
      sub_type: "quick_reply",
      index: "0",
      parameters: [
        {
          type: "payload",
          payload: "para_recoger_local"
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
          payload: "entrega_domicilio"
        }
      ]
    },
    {
      type: "button",
      sub_type: "quick_reply",
      index: "2",
      parameters: [
        {
          type: "payload",
          payload: "regresar_inicio"
        }
      ]
    }
  ];

  await enviarPayload(to, templates.PEDIDO, components);
}

async function enviarPlantillaUbicacionHorario(to, ubicacionData = null) {
  const components = [
    {
      type: "header",
      parameters: [
        {
          type: "location",
          location: ubicacionData || {
            longitude: "-100.9754",  // Plaza de Armas de Saltillo
            latitude: "25.4232",     // Plaza de Armas de Saltillo
            name: "Los Pollos Hermanos",
            address: "Centro Histórico, Saltillo, Coahuila"
          }
        }
      ]
    },
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
          payload: "regresar_inicio"
        }
      ]
    }
  ];

  await enviarPayload(to, templates.UBICACION_HORARIO, components);
}

// 6. PEDIDO_DIRECTO - CON BODY PARÁMETRO {{1}}
async function enviarPlantillaPedidoDirecto(to, platillo) {
  const components = [
    {
      type: "body",
      parameters: [
        {
          type: "text",
          text: sanitize(platillo) // {{1}}
        }
      ]
    },
    {
      type: "button",
      sub_type: "quick_reply",
      index: "0",
      parameters: [
        {
          type: "payload",
          payload: "para_recoger_local"
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
          payload: "entrega_domicilio"
        }
      ]
    },
    {
      type: "button",
      sub_type: "quick_reply",
      index: "2",
      parameters: [
        {
          type: "payload",
          payload: "regresar_inicio"
        }
      ]
    }
  ];

  await enviarPayload(to, templates.PEDIDO_DIRECTO, components);
}

// 7. PEDIDO_DOMICILIO - CON HEADER Y 3 PARÁMETROS EN BODY
async function enviarPlantillaPedidoDomicilio(to, platillo, ubicacionTexto = "Ubicación", metodoPagoTexto = "Método de pago") {
  const components = [
    // NO enviar header - es texto fijo en la plantilla
    {
      type: "body",
      parameters: [
        {
          type: "text",
          text: sanitize(platillo) // {{1}}
        },
        {
          type: "text",
          text: sanitize(ubicacionTexto) // {{2}}
        },
        {
          type: "text",
          text: sanitize(metodoPagoTexto) // {{3}}
        }
      ]
    },
    {
      type: "button",
      sub_type: "quick_reply",
      index: "0",
      parameters: [
        {
          type: "payload",
          payload: "efectivo"
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
          payload: "deposito_transferencia"
        }
      ]
    },
    {
      type: "button",
      sub_type: "quick_reply",
      index: "2",
      parameters: [
        {
          type: "payload",
          payload: "confirmar_pedido"
        }
      ]
    },
    {
      type: "button",
      sub_type: "quick_reply",
      index: "3",
      parameters: [
        {
          type: "payload",
          payload: "regresar_inicio"
        }
      ]
    }
  ];

  await enviarPayload(to, templates.PEDIDO_DOMICILIO, components);
}

// 8. PEDIDO_RECOGER - CON HEADER Y 1 PARÁMETRO EN BODY
async function enviarPlantillaPedidoRecoger(to, platillo) {
  const components = [
    // NO ENVIAR HEADER - es texto fijo en la plantilla
    {
      type: "body",
      parameters: [
        {
          type: "text",
          text: sanitize(platillo) // {{1}}
        }
      ]
    },
    {
      type: "button",
      sub_type: "quick_reply",
      index: "0",
      parameters: [
        {
          type: "payload",
          payload: "confirmar_pedido"
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
          payload: "regresar_inicio"
        }
      ]
    }
  ];

  await enviarPayload(to, templates.PEDIDO_RECOGER, components);
}

// 9. PAGO_DEPOSITO - CON HEADER Y 3 PARÁMETROS EN BODY
async function enviarPlantillaPagoDeposito(to, banco, nombre, cuentaClabe) {
  const url = `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`;
  to = procesarNumero(to);

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: "pago_deposito",
      language: { code: "en" },  // ← ¡INGLÉS!
      components: [
        {
          type: "body",
          parameters: [
            {
              type: "text",
              text: sanitize(banco)
            },
            {
              type: "text",
              text: sanitize(nombre)
            },
            {
              type: "text",
              text: sanitize(cuentaClabe)
            }
          ]
        }
      ],
    },
  };

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  try {
    const response = await axios.post(url, payload, { headers });
    logExitoso(payload, response.data);
    return response.data;
  } catch (error) {
    logError(payload, error);
    throw error;
  }
}

// Función genérica - MODIFICADA para no enviar parámetros a plantillas que no los aceptan
async function enviarPlantillaWhatsApp(to, templateName, params = []) {
  const components = [];
  
  // Plantillas que NO aceptan parámetros
  const plantillasSinParametros = [
    templates.MENU_INICIO,
    templates.MENU_HOY, 
    templates.UBICACION_HORARIO,
    templates.PEDIDO
  ];
  
  // Plantillas que aceptan 1 parámetro
  const plantillasCon1Param = [
    templates.OFERTAS,
    templates.PEDIDO_RECOGER,
    templates.PEDIDO_DIRECTO
  ];
  
  // Plantillas que aceptan 3 parámetros
  const plantillasCon3Param = [
    templates.PAGO_DEPOSITO,
    templates.PEDIDO_DOMICILIO
  ];
  
  if (plantillasSinParametros.includes(templateName)) {
    // No enviar parámetros
    console.log(`⚠️  ${templateName} no acepta parámetros, enviando sin ellos`);
    await enviarPayload(to, templateName, []);
    return;
  }
  
  if (plantillasCon1Param.includes(templateName) && params[0]) {
    components.push({
      type: "body",
      parameters: [
        {
          type: "text",
          text: sanitize(params[0])
        }
      ]
    });
  }
  
  if (plantillasCon3Param.includes(templateName) && params.length >= 3) {
    components.push({
      type: "header",
      parameters: [
        {
          type: "text",
          text: params[0] || ""
        }
      ]
    });
    
    components.push({
      type: "body",
      parameters: [
        {
          type: "text",
          text: sanitize(params[1])
        },
        {
          type: "text",
          text: sanitize(params[2])
        },
        {
          type: "text",
          text: sanitize(params[3] || "")
        }
      ]
    });
  }

  await enviarPayload(to, templateName, components);
}

async function enviarMensajeTexto(to, text) {
  const url = `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to: procesarNumero(to),
    type: "text",
    text: { body: text },
  };

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  try {
    const response = await axios.post(url, payload, { headers });
    logExitoso(payload, response.data);
    return response.data;
  } catch (error) {
    logError(payload, error);
    throw error;
  }
}

// Funciones auxiliares para logging
function logExitoso(payload, responseData) {
  const logMessage = `${new Date().toISOString()} - Enviado: ${JSON.stringify(payload)}\nRespuesta: ${JSON.stringify(responseData)}\n`;
  fs.appendFileSync("template_log.txt", logMessage);
}

function logError(payload, error) {
  const errorData = error.response?.data || error.message;
  const logMessage = `${new Date().toISOString()} - Error enviando: ${JSON.stringify(payload)}\nError: ${JSON.stringify(errorData)}\n`;
  fs.appendFileSync("template_log.txt", logMessage);
}

module.exports = {
  templates,
  enviarPlantillaWhatsApp,
  enviarMensajeTexto,
  enviarPlantillaMenuInicio,
  enviarPlantillaMenuHoy,
  enviarPlantillaUbicacionHorario,
  enviarPlantillaPagoDeposito,
  enviarPlantillaPedidoDomicilio,
  enviarPlantillaPedidoRecoger,
  enviarPlantillaPedidoDirecto,
  enviarPlantillaPedido,
  enviarPlantillaOfertas,
  enviarPayload,
  procesarNumero
};