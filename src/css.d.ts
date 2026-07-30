declare module '*.css';

declare module '*?url' {
  const url: string;
  export default url;
}

// Vite ?arraybuffer import:返回字体/二进制资源的 ArrayBuffer
declare module '*?arraybuffer' {
  const buffer: ArrayBuffer;
  export default buffer;
}
