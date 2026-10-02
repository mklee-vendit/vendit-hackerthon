import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import svgr from 'vite-plugin-svgr';

export default defineConfig({
  plugins: [
    tailwindcss(),
    svgr({ svgrOptions: { exportType: 'default' } }),
    react(),
    // plugin-react v6 의 내부 Babel 은 Oxc 로 교체됐고 React Compiler 는 Babel 전용이라
    // 별도 Babel 패스로 분리해 주입한다(공식 권장 패턴).
    babel({
      presets: [reactCompilerPreset()],
      // exclude 를 주면 플러그인 기본값(node_modules·rolldown 런타임)이 통째로 대체되므로 같이 적는다.
      exclude: [/node_modules/, /^\0rolldown\/runtime\.js$/],
    }),
  ],
  resolve: {
    alias: { '@': '/src' },
    dedupe: ['react', 'react-dom'],
  },
});
