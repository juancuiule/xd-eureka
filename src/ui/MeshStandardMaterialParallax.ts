import * as THREE from "three";
import { MeshStandardMaterial, Shader, Texture, WebGLRenderer } from "three";
import { MeshStandardMaterialParameters } from "three/src/materials/MeshStandardMaterial";

import { checkWebP } from "../utils/MathUtils";

export interface PageData {
  frames: FrameElement[];
  meta: Meta;
}

export interface FrameElement {
  filename: string;
  frame: SpriteSourceSizeClass;
  rotated: boolean;
  trimmed: boolean;
  parallax?: { x: number; y: number };
  spriteSourceSize: SpriteSourceSizeClass;
  sourceSize: Size;
}

export interface SpriteSourceSizeClass {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Size {
  w: number;
  h: number;
}

export interface Meta {
  app: string;
  version: string;
  image: string;
  format: string;
  size: Size;
  scale: string;
  smartupdate: string;
}

export class MeshStandardMaterialParallax extends MeshStandardMaterial {
  private textures: Texture[] = [];
  private anisotropy: number;

  constructor(
    anisotropy: number,
    renderer: WebGLRenderer,
    parameters?: MeshStandardMaterialParameters
  ) {
    super(parameters);
    this.renderer = renderer;
    this.anisotropy = anisotropy;
    this.onBeforeCompile = this.beforeCompileModifier;
  }

  public addPage = (pageData: PageData) => {
    pageData.frames.reverse().forEach((frame, index) => {
      let filename = checkWebP(`images/pages/png/${frame.filename}`);
      let texture = new THREE.TextureLoader().load(filename, () => {
        this.renderer.initTexture(texture);
      });
      texture.flipY = false;
      texture.premultiplyAlpha = (window as any).Main.PREMULTIPLIEDALPHA;
      texture.anisotropy = this.anisotropy;
      this.textures.push(texture);
    });
  };
  private renderer: WebGLRenderer;

  private beforeCompileModifier = (shader: Shader, renderer: WebGLRenderer) => {
    this.map = this.textures[0];
  };
}
