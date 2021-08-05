import {IUniform, MeshStandardMaterial, Shader, Texture, Vector2, Vector3, Vector4, WebGLRenderer} from "three";
import {MeshStandardMaterialParameters} from "three/src/materials/MeshStandardMaterial";
import * as THREE from "three";
import * as dat from 'dat.gui';
import {checkWebP} from "../utils/MathUtils";

export interface PageData {
    frames: FrameElement[];
    meta: Meta;
}

export interface FrameElement {
    filename: string;
    frame: SpriteSourceSizeClass;
    rotated: boolean;
    trimmed: boolean;
    parallax?: { x: number, y: number };
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

const DUMMY_TEXTURE = new THREE.Texture();

export class MeshStandardMaterialParallax extends MeshStandardMaterial {
    public iResolution: IUniform;
    private _gui: dat.GUI;

    private textures: Texture[] = [];
    private moveFactors: Vector2[] = [];
    private moveFactorDefaults: Vector2[] = [new Vector2(0.25, 0.25), new Vector2(0.5, 0.5), new Vector2(2, 1), new Vector2(1, 1), new Vector2(1.5, 0.1), new Vector2(3, 0.1)];
    private textureDimensions: Vector4[] = [];
    private anisotropy: number;

    constructor(anisotropy: number, renderer:WebGLRenderer, parameters?: MeshStandardMaterialParameters, gui?: dat.GUI) {
        super(parameters);
        this.renderer = renderer;
        this.anisotropy = anisotropy;
        this._gui = gui;
        this.onBeforeCompile = this.beforeCompileModifier;
    }

    public addPage = (pageData: PageData, pageNumber = 0) => {
        pageData.frames.reverse().forEach((frame, index) => {
            let filename = checkWebP(`images/${pageNumber.toString().padStart(2, '0')}/${frame.filename}`);
            let texture = new THREE.TextureLoader().load(filename, () => {
                this.renderer.initTexture(texture);
            });
            texture.flipY = false;
            texture.premultiplyAlpha = (window as any).Main.PREMULTIPLIEDALPHA;
            texture.anisotropy = this.anisotropy;
            this.moveFactors.push(this.moveFactorDefaults[index]);
            this.textures.push(texture);
            this.textureDimensions.push(new Vector4(
                frame.spriteSourceSize.x / frame.spriteSourceSize.w,
                frame.spriteSourceSize.y / frame.spriteSourceSize.h,
                frame.spriteSourceSize.w,
                frame.spriteSourceSize.h
            ));
        })
    }
    private renderer: WebGLRenderer;

    private beforeCompileModifier = (shader: Shader, renderer: WebGLRenderer) => {
        this.map = this.textures[0];

        shader.uniforms.iResolution = {value: new Vector3(2100, 1200, 1)};
        shader.uniforms.map2Offset = {value: new Vector2(0, 0)};

        this.iResolution = shader.uniforms.iResolution;
        this.userData.shader = shader;
        
        if (this._gui) {
            this._gui.add(shader.uniforms.moveFactor.value, 'x', 0, 5).name('layer0 .x');
            this._gui.add(shader.uniforms.moveFactor.value, 'y', 0, 5).name('layer0 .y');
        }
    }
}