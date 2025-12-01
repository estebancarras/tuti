# 📋 ESTADO DEL PROYECTO: TUTIFRUTI ONLINE (Project Phoenix)
**Fecha**: 2025-12-01  
**Fase**: Inicialización Completada - Listo para Desarrollo de Features  
**Repositorio**: https://github.com/estebancarras/tuti

---

## 🎯 VISIÓN DEL PROYECTO
Juego multijugador en tiempo real tipo "Basta/Stop" con arquitectura moderna, escalable y sin deuda técnica desde el primer commit.

---

## ✅ LO QUE YA ESTÁ HECHO

### 1. Infraestructura Base
- ✅ Repositorio Git inicializado y subido a GitHub
- ✅ Estructura de carpetas profesional (`/party`, `/src`, `/shared`)
- ✅ Configuración completa de TypeScript (modo estricto)
- ✅ Build tool configurado (Vite)
- ✅ Sistema de estilos (Tailwind CSS)
- ✅ `.gitignore` configurado correctamente (excluye `node_modules`)

### 2. Stack Tecnológico Implementado
- ✅ **Frontend**: Vue 3 (Composition API) + HTMX
- ✅ **Backend**: PartyKit (estructura creada)
- ✅ **Validación**: Zod (esquemas base definidos)
- ✅ **Estilos**: Tailwind CSS
- ✅ **Lenguaje**: TypeScript estricto en todo el stack

### 3. Código Base
- ✅ Tipos compartidos (`shared/types.ts`): `GameStatus`, `Player`, `RoomState`
- ✅ Esquemas Zod (`shared/schemas.ts`): Validación de datos
- ✅ Servidor PartyKit básico (`party/server.ts`): Responde "WELCOME"
- ✅ Cliente Vue (`src/App.vue`): UI con indicador de conexión
- ✅ Composable WebSocket (`src/composables/useSocket.ts`): Lógica de conexión

### 4. Estado Actual del Desarrollo
- ✅ **Frontend corriendo**: `http://localhost:5174` (Vite funcionando)
- ⚠️ **Backend con problemas**: PartyKit tiene bug en Windows (rutas de archivos)
- 🟡 **Conexión**: Frontend muestra "Disconnected" (esperado sin backend)

---

## 🚧 PROBLEMAS TÉCNICOS IDENTIFICADOS

### Problema Principal: PartyKit en Windows
**Descripción**: PartyKit CLI tiene un bug conocido con rutas de Windows que impide ejecutar el servidor localmente.

**Error específico**:
```
ERR_INVALID_URL: '.\\file:\\C:\\Users\\fuige\\tutifruti\\node_modules\\partykit\\dist\\generated.js'
```

**Impacto**: No podemos probar la funcionalidad de WebSockets en desarrollo local.

**Soluciones Posibles**:
1. **Opción A (Temporal)**: Crear un mock server con `ws` (WebSocket simple) para desarrollo local
2. **Opción B (Producción)**: Desplegar directamente a Cloudflare donde PartyKit funciona correctamente
3. **Opción C (Alternativa)**: Usar WSL (Windows Subsystem for Linux) para desarrollo

---

## 🎯 PRÓXIMOS PASOS ESTRATÉGICOS

### FASE 2: Resolver Backend y Establecer Comunicación
**Objetivo**: Lograr comunicación bidireccional Cliente ↔ Servidor

**Decisiones Arquitectónicas Necesarias**:
1. ¿Usamos mock server para desarrollo local o trabajamos directo en producción?
2. ¿Definimos el protocolo de mensajes WebSocket ahora o después?
3. ¿Qué eventos del juego necesitamos desde el inicio?

**Tareas Técnicas** (una vez decidido el enfoque):
- [ ] Establecer servidor WebSocket funcional (mock o PartyKit en cloud)
- [ ] Definir protocolo de mensajes (tipos de eventos)
- [ ] Implementar handshake de conexión
- [ ] Probar conexión bidireccional

---

### FASE 3: Implementar Lobby (Gestión de Salas)
**Objetivo**: Permitir crear/unirse a salas de juego

**Decisiones de Diseño**:
1. ¿Las salas son públicas, privadas o ambas?
2. ¿Cuántos jugadores por sala? (mínimo/máximo)
3. ¿Quién puede iniciar la partida? (solo host o votación)
4. ¿Cómo se manejan las desconexiones en el lobby?

**Features a Implementar**:
- [ ] UI del Lobby (HTMX)
- [ ] Crear sala (generar código único)
- [ ] Unirse a sala (por código)
- [ ] Lista de jugadores en sala
- [ ] Sistema de "host" (primer jugador)
- [ ] Botón "Iniciar Partida" (solo para host)

---

### FASE 4: Lógica del Juego (Game Island)
**Objetivo**: Implementar el tablero de juego activo

**Decisiones de Gameplay**:
1. ¿Qué categorías incluimos? (Nombre, Animal, Color, etc.)
2. ¿Cuántas rondas por partida?
3. ¿Tiempo por ronda? (configurable o fijo)
4. ¿Sistema de puntuación? (palabra única = 10pts, repetida = 5pts, etc.)
5. ¿Validación de palabras? (votación entre jugadores o diccionario automático)

**Features a Implementar**:
- [ ] Componente Vue del tablero (`GameView.vue`)
- [ ] Inputs para cada categoría
- [ ] Timer visual
- [ ] Botón "BASTA/STOP"
- [ ] Sistema de validación de palabras
- [ ] Pantalla de resultados por ronda
- [ ] Tabla de puntuaciones final

---

### FASE 5: Estado del Servidor (Server-Authoritative)
**Objetivo**: El servidor mantiene la "Verdad Única"

**Decisiones Arquitectónicas**:
1. ¿Cómo persistimos el estado si el servidor se reinicia?
2. ¿Usamos Durable Objects Storage de Cloudflare?
3. ¿Qué pasa si un jugador se desconecta a mitad de partida?

**Features a Implementar**:
- [ ] `RoomState` completo en servidor
- [ ] Sincronización de estado con clientes
- [ ] Manejo de reconexiones
- [ ] Sistema de turnos/rondas
- [ ] Validación server-side de todas las acciones

---

### FASE 6: Pulido y Despliegue
**Objetivo**: Preparar para producción

**Tareas**:
- [ ] Optimización de rendimiento
- [ ] Manejo de errores robusto
- [ ] UX/UI polish (animaciones, feedback)
- [ ] Testing (manual o automatizado)
- [ ] Deploy a Cloudflare (PartyKit + Pages)
- [ ] Configurar dominio personalizado (opcional)

---

## 🤔 PREGUNTAS PARA EL ARQUITECTO (GEMINI)

### Estrategia de Desarrollo
1. **¿Priorizamos velocidad o robustez?**  
   - ¿Hacemos un MVP rápido o construimos todo bien desde el inicio?

2. **¿Enfoque de desarrollo?**  
   - ¿Feature por feature completa (vertical) o capa por capa (horizontal)?

3. **¿Cómo manejamos el problema de PartyKit en Windows?**  
   - ¿Mock server, deploy directo a cloud, o WSL?

### Diseño del Juego
4. **¿Qué features son MUST-HAVE para el MVP?**  
   - ¿Cuál es el mínimo viable para que sea jugable?

5. **¿Sistema de validación de palabras?**  
   - ¿Votación entre jugadores (más social) o diccionario automático (más rápido)?

6. **¿Persistencia de partidas?**  
   - ¿Las partidas se pueden pausar/reanudar o son efímeras?

---

## 📊 MÉTRICAS DE PROGRESO

### Completado: ~15%
- ✅ Infraestructura: 100%
- ✅ Tipos base: 100%
- 🟡 Comunicación Cliente-Servidor: 30% (estructura creada, sin conexión real)
- ⬜ Lobby: 0%
- ⬜ Gameplay: 0%
- ⬜ Validación: 0%
- ⬜ Despliegue: 0%

---

## 🎯 RECOMENDACIÓN INMEDIATA

**Siguiente Milestone Sugerido**: **"Primera Conexión Exitosa"**

**Objetivo**: Ver el círculo verde (🟢 Connected) en la UI.

**Opciones**:
1. **Rápido pero temporal**: Implementar mock server con `ws`
2. **Correcto pero más lento**: Configurar WSL y ejecutar PartyKit ahí
3. **Producción first**: Deploy a Cloudflare y desarrollar contra el servidor en la nube

**Pregunta clave**: ¿Qué enfoque prefieres para continuar?

---

## 📁 ESTRUCTURA ACTUAL DEL PROYECTO

```
c:\Users\fuige\tutifruti\
├── party/
│   ├── main.ts          # Entry point PartyKit
│   ├── server.ts        # Lógica del servidor (básica)
│   └── mock-server.js   # Mock server (creado, no probado)
├── src/
│   ├── components/      # (vacío, para componentes Vue)
│   ├── composables/
│   │   └── useSocket.ts # Lógica WebSocket
│   ├── App.vue          # Componente raíz
│   ├── main.ts          # Entry point Vue
│   ├── style.css        # Tailwind imports
│   └── vite-env.d.ts    # Type definitions
├── shared/
│   ├── types.ts         # Tipos compartidos
│   └── schemas.ts       # Zod schemas
├── public/              # Assets estáticos
├── .gitignore
├── index.html
├── package.json
├── partykit.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

---

## 🔗 RECURSOS

- **Repositorio**: https://github.com/estebancarras/tuti
- **Documentación PartyKit**: https://docs.partykit.io
- **Vue 3 Docs**: https://vuejs.org
- **Zod Docs**: https://zod.dev

---

**Nota Final**: Este proyecto está en un estado sólido de inicialización. La arquitectura es correcta, el stack es moderno, y el código está limpio. El único blocker es la ejecución local de PartyKit en Windows, que tiene soluciones viables. Estamos listos para tomar decisiones estratégicas y avanzar a la implementación de features.
