# GoChat

Chat en tiempo real con **mensajes cifrados**, notas de voz, fotos, videos, documentos y **llamadas o videollamadas grupales**.

## Cómo arrancarlo

```bash
npm install
npm run dev
```

Abre [http://127.0.0.1:45217](http://127.0.0.1:45217), regístrate (teléfono, código de demo `482910`, nombre y foto) y crea un grupo. La interfaz es como WhatsApp Web: lista de chats a la izquierda y conversación a la derecha.

Producción:

```bash
npm run build
npm start
```

## Chat y archivos

- Texto, emojis, notas de voz, cámara, fotos, videos y documentos (menú del clip o arrastrando un archivo)
- Límite: **8 MB** por archivo
- El teclado usa texto a 16px para que iOS, Android, tablets y PC no hagan zoom al escribir. La ventana se ajusta al teclado virtual (iPhone, Android, iPad, Windows, Linux, Mac).

Los archivos viajan cifrados por Socket.io y se quedan en memoria mientras la sala tenga gente. Si todos salen, la sala se borra.

## Llamadas y videollamadas grupales

1. Entra a la misma sala en **dos pestañas** (o dos móviles) con el **enlace completo** (botón copiar).
2. En una, pulsa el icono de teléfono o de cámara.
3. En la otra, pulsa **Unirme**.
4. Acepta micrófono (y cámara, si es videollamada).

Hasta **8 personas** (malla WebRTC). Si sales por tu cuenta puedes **volver a entrar**. Si el anfitrión te **expulsa**, no puedes volver hasta que esa llamada termine.

## Privacidad y seguridad

- **Cifrado de extremo a extremo** (AES-GCM). La clave va en el enlace (`#s=…`) y no se manda al servidor. Sin el enlace completo los mensajes se ven bloqueados.
- **Modo senior**: icono de accesibilidad en la barra. Letras y botones más grandes. Se puede activar y desactivar.
- **Bloquear / desbloquear** personas desde la ficha del grupo. No verás sus mensajes ni recibirás su señal de llamada.
- **Escudo antiestafas** en el dispositivo: avisa si el texto parece phishing, pedido de dinero o suplantación. No es un antivirus en la nube.
- **Archivos camuflados**: se rechazan ejecutables, doble extensión (`foto.pdf.exe`), PDF con JavaScript o acciones automáticas, y PDFs que no empiezan por `%PDF`.
- Cabeceras HTTP (no-iframe, nosniff, CSP) y tope de envíos para no inundar la sala.

Ninguna app en el navegador es indestructible: no abras archivos de desconocidos en el ordenador y no compartas códigos bancarios.

## Si una llamada no conecta entre redes distintas

En la misma máquina o la misma Wi‑Fi suele bastar STUN (incluido). Entre redes con NAT estricto hace falta un servidor **TURN**:

```bash
NEXT_PUBLIC_TURN_URL=turn:tu-servidor:3478
NEXT_PUBLIC_TURN_USERNAME=usuario
NEXT_PUBLIC_TURN_CREDENTIAL=clave
```

También hace falta **HTTPS** (o localhost) para que el navegador deje usar cámara y micrófono.

## Publicar en GitHub y Render

GoChat no va en Vercel: las llamadas necesitan un proceso Node persistente con WebSockets. En Render sí.

1. Crea el repositorio de GitHub (en este chat, el botón **Create repo**).
2. En [Render](https://dashboard.render.com) → **New** → **Blueprint**.
3. Conecta el repo y aplica el `render.yaml`.
4. Render asigna `PORT` solo.

Opcional: si me pasas un `RENDER_API_KEY` (Account Settings → API Keys) y el repo ya está en GitHub, puedo lanzar el servicio desde aquí.
