import * as dat from "dat.gui";
import { gsap } from "gsap";
import { Draggable } from "gsap/Draggable";
import { InertiaPlugin } from "gsap/InertiaPlugin";
import * as THREE from "three";
import {
  AmbientLight,
  DirectionalLight,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  SpotLight,
  Texture,
  Vector2,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import Stats from "three/examples/jsm/libs/stats.module";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
// @ts-ignore
import BgMap from "../assets/images/bg.jpg";
// @ts-ignore
import RoughnessMap2 from "../assets/models/bump.jpg";
// @ts-ignore
import BookCover from "../assets/models/cover_blender.glb";
// @ts-ignore
import NormalMap from "../assets/models/normal.jpg";
// @ts-ignore
import BookPage from "../assets/models/page_blender.glb";
// @ts-ignore
import RoughnessMap from "../assets/models/roughness_2.jpg";

import {
  MeshStandardMaterialParallax,
  PageData,
} from "../ui/MeshStandardMaterialParallax";
import { checkWebP, fitCameraToSelection } from "../utils/MathUtils";

gsap.registerPlugin(InertiaPlugin, Draggable);

//For webgl1 browsers:
MathUtils.floorPowerOfTwo = (value) => {
  if (value === 2100 || value === 1200) {
    //Regular floorPowersOfTwo:
    return Math.pow(2, Math.floor(Math.log(value) / Math.LN2));
  }
  return MathUtils.ceilPowerOfTwo(value);
};

const pages = Array.from({ length: 23 }).map((_, i) => {
  return {
    frames: [
      {
        filename: i === 0 ? `page-1.webp` : `page-${i + 1}.jpg`,
        frame: {
          x: 1,
          y: 1,
          w: 4752,
          h: 3170,
        },
        rotated: !1,
        trimmed: !1,
        spriteSourceSize: {
          x: 0,
          y: 0,
          w: 4752,
          h: 3170,
        },
        sourceSize: {
          w: 4752,
          h: 3170,
        },
      },
    ],
  };
});

export class MaskRevealView {
  private renderer: WebGLRenderer;
  private camera: PerspectiveCamera;
  private cameraWrapper: THREE.Object3D;
  private _parent: HTMLElement;
  private scene: Scene;

  private controls: OrbitControls;
  private groundPlane: THREE.Mesh<THREE.PlaneBufferGeometry, THREE.Material>;
  private ambLight: AmbientLight;

  private dirLight: DirectionalLight;
  private spotLight: SpotLight;

  private ambientMove = { x: 0, y: 0 };

  private dim = new Vector2();
  private _isActive: boolean = false;

  private animationFrame: number;
  private draggable: Draggable;

  private pageMaterials: MeshStandardMaterialParallax[] = [];
  private gui: dat.GUI;
  private stats: Stats;
  private coverMaterial: MeshStandardMaterial;
  private backCoverMaterial: MeshStandardMaterial;
  private cover: Mesh;
  private coverBack: Mesh;
  private bookWrapper: Object3D;
  private pagesWrapper: Group;

  private pageDatas: PageData[] = pages;
  private pageSide: Object3D;

  //For resizing;
  private cornerMarker = new THREE.Mesh(
    new THREE.PlaneBufferGeometry(2.2, 1.25)
  );
  private flipTimeline = gsap.timeline({ paused: true, ease: "none" });
  private pages: THREE.Object3D[] = [];
  private coverWrapper: Group;

  private currPageIndex = 0;
  private draggableElement: Element;

  private modelsLoaded = 0;
  private texturesLoaded = false;

  private ENTERED = false;
  private ENTERING = false;
  private bookPixelWidth: number;

  private SKIP_INTRO = true;

  private cameraLookAtPosition = new THREE.Object3D();
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private ON_LANDING_SCREEN: boolean = false;
  // private menu: Menu;
  private lastPageBookMoveTween: gsap.core.Tween;
  private coverBottomBack: Mesh;
  private currentViewYOffset: number = 0;

  constructor(parent: HTMLElement) {
    this._parent = parent;

    this.setupScene();
    this.setupDraggable();
  }

  private setupDraggable() {
    this.draggableElement = document.querySelector(".draggable") as HTMLElement;
    gsap.set(this.draggableElement, {
      width: (this.pageDatas.length + 2) * 100 + "%",
    });

    this.draggable = Draggable.create(this.draggableElement, {
      type: "left",
      bounds: this._parent,
      inertia: true,
      // lockAxis: true,
      // zIndexBoost: false,
      // minimumMovement: 20,
      // edgeResistance: 0,
      onDragStart: () => {
        gsap.killTweensOf(this.flipTimeline);
      },
      onClick: (e) => {
        if (e.srcElement.nodeName === "A") {
          if ((window as any).Main.IS_ANDROID) {
            e.srcElement.click();
          }
        } else {
          this.clickHandler(e);
        }
      },
      onDrag: this.dragUpdate,
      onThrowUpdate: this.dragUpdate,
      allowNativeTouchScrolling: Boolean((window as any).Main.I_OS), //This currently breaks android scrolling / dragging.
      // allowEventDefault: true,
      snap: (value) => {
        let page = gsap.utils.clamp(
          -this.pageDatas.length - 1,
          0,
          Math.round(value / this.dim.width)
        );
        return page * this.dim.width;
      },
    })[0];
    this.draggable.disable();
  }

  private setupScene() {
    THREE.DefaultLoadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
      console.log(
        "Loading file: " +
          url +
          ".\nLoaded " +
          itemsLoaded +
          " of " +
          itemsTotal +
          " files."
      );
      if (itemsLoaded === itemsTotal) {
        this.texturesLoaded = true;
        this.modelsLoadedCheck();
      }
    };

    this.cameraWrapper = new Object3D();
    this.camera = new PerspectiveCamera(
      36,
      this._parent.clientWidth / this._parent.clientHeight,
      0.01,
      15
    );
    this.camera.position.z = 2.54;
    this.cameraWrapper.add(this.camera);

    this.scene = new Scene();
    this.scene.add(this.cameraWrapper);

    this.renderer = new WebGLRenderer({
      antialias: true,
      stencil: false,
      powerPreference: "high-performance",
      premultipliedAlpha: (window as any).Main.PREMULTIPLIEDALPHA,
    });
    this.renderer.setClearColor(0x000000);
    this.renderer.setPixelRatio(
      gsap.utils.clamp(1, 3, window.devicePixelRatio)
    );
    this.renderer.setSize(this._parent.clientWidth, this._parent.clientHeight);
    this._parent.prepend(this.renderer.domElement);

    this.ambLight = new AmbientLight(0xffffff);
    this.ambLight.name = "ambLight";
    this.ambLight.intensity = 0.72;
    this.scene.add(this.ambLight);

    this.dirLight = new DirectionalLight(0xffffff);
    this.dirLight.name = "dirLight";
    this.dirLight.intensity = 0.28;
    this.dirLight.position.set(0, 5, 0.56);

    this.spotLight = new SpotLight(0xffffff);
    this.spotLight.name = "spotLight";
    this.spotLight.intensity = 0.12;
    this.spotLight.position.set(0, 0, 25);

    this.scene.add(this.spotLight);
    this.scene.add(this.dirLight);

    let bgTex = new THREE.TextureLoader().load(BgMap);
    bgTex.wrapT = THREE.RepeatWrapping;
    bgTex.wrapS = THREE.RepeatWrapping;
    bgTex.repeat.x = 3 * 10;
    bgTex.repeat.y = 3 * 10;
    this.groundPlane = new THREE.Mesh(
      new THREE.PlaneBufferGeometry(6 * 10, 6 * 10),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: bgTex,
        roughness: 0.7,
        metalness: 1,
      })
    );
    this.groundPlane.position.y = 16;
    this.groundPlane.name = "groundPlane";
    this.scene.add(this.groundPlane);
    this.cameraLookAtPosition.name = "cameraLookAtPosition";
    this.scene.add(this.cameraLookAtPosition);

    this.loadModel();

    // this.menu.position.z = 0.04;
    // this.menu.position.y = -0.72;
    // this.menu.position.x = this.menu.width * -0.5;
    // this.scene.add(this.menu);

    let speed = 8;
    gsap.fromTo(
      this.ambientMove,
      { y: -0.03 },
      {
        y: 0.03,
        ease: "sine.inOut",
        duration: 7.5 * speed,
        repeat: -1,
        yoyo: true,
      }
    );
    gsap.fromTo(
      this.ambientMove,
      { x: 0.04 },
      {
        x: -0.04,
        ease: "sine.inOut",
        duration: 3.75 * speed,
        repeat: -1,
        yoyo: true,
      }
    );
  }

  private loadModel() {
    this.setupPageMaterials();

    this.bookWrapper = new THREE.Object3D();
    this.bookWrapper.name = "bookWrapper";
    this.bookWrapper.position.y = -2.88;
    this.bookWrapper.rotation.z = 0.38;
    this.cameraLookAtPosition.position.y = -2.88;
    this.scene.add(this.bookWrapper);

    var loader = new GLTFLoader();
    loader.load(BookCover, (gltf) => {
      gltf.scene.rotation.x = Math.PI / 2;
      gltf.scene.name = "bookCoverWrapper";
      gltf.scene.position.z = 0.02;
      this.cover = gltf.scene.getObjectByName("cover_top") as THREE.Mesh;
      this.coverBottomBack = gltf.scene.getObjectByName(
        "cover_bottom_back"
      ) as THREE.Mesh;
      this.coverBottomBack.position.y = 0.038;
      this.coverBottomBack.scale.y = 0.8;
      this.coverBack = this.cover.clone(true);
      this.coverBack.name = "coverBack";
      let firstPage = gltf.scene.getObjectByName(
        "first_page_top"
      ) as THREE.Mesh;

      this.cover.material = this.coverMaterial;
      this.coverBack.material = this.backCoverMaterial;
      firstPage.position.x = this.cover.position.x;
      firstPage.material = this.pageMaterials[0];
      this.coverWrapper = gltf.scene;
      this.bookWrapper.add(gltf.scene);

      this.flipTimeline.fromTo(
        firstPage.morphTargetInfluences as number[],
        { 0: 0, 1: 1 },
        {
          duration: 0.5,
          0: 1,
          1: 0,
          ease: "none",
        },
        0.5
      );
      this.flipTimeline.to(
        firstPage.morphTargetInfluences as number[],
        { duration: 0.5, 0: 0, 1: 1, ease: "none" },
        1
      );
      this.flipTimeline.to(this.cover.rotation, { duration: 1, z: Math.PI }, 0);
      this.flipTimeline.fromTo(
        this.bookWrapper.position,
        { x: -0.5 },
        { duration: 1, x: 0 },
        0
      );
      this.modelsLoaded++;
      this.modelsLoadedCheck();
    });
    loader.load(BookPage, (gltf) => {
      this.pagesWrapper = gltf.scene;
      gltf.scene.rotation.x = Math.PI / 2;
      gltf.scene.name = "pagesWrapper";

      this.pageSide = gltf.scene.getObjectByName("wrapper") as THREE.Object3D;
      this.pageSide.rotation.z = 0;

      this.bookWrapper.add(gltf.scene);

      this.modelsLoaded++;
      this.modelsLoadedCheck();
    });
  }

  private setupPages() {
    let page = this.pageSide;
    this.pageMaterials.forEach((mat, index) => {
      if (index > 0) {
        page = this.pageSide.clone(true);
        this.pagesWrapper.add(page);
      }
      page.position.y = 0.075 - index * 0.005;
      (page.children[0] as THREE.Mesh).material = mat;
      if (index < this.pageMaterials.length - 1) {
        (page.children[1] as THREE.Mesh).material =
          this.pageMaterials[index + 1];
      }
      this.pages.push(page);
    });
    this.pages.forEach((page, index) => {
      if (index > 0) {
        this.flipTimeline.fromTo(
          (this.pages[index - 1].children[1] as THREE.Mesh)
            .morphTargetInfluences as number[],
          {
            0: 0,
            1: 1,
          },
          { duration: 0.5, 0: 1, 1: 0, ease: "none" },
          index + 0.5
        );
        this.flipTimeline.to(
          (this.pages[index - 1].children[1] as THREE.Mesh)
            .morphTargetInfluences as number[],
          {
            duration: 0.5,
            0: 0,
            1: 1,
            ease: "none",
          },
          index + 1
        );
      }
      if (index === this.pages.length - 1) {
        page.add(this.coverBack);
        this.coverBack.remove(this.coverBack.children[0]);
        this.coverBack.position.y = 0.0035;
        page.remove(page.children[1]);
        this.flipTimeline.to(
          page.rotation,
          { duration: 1, z: Math.PI, ease: "none" },
          index + 1
        );

        this.lastPageBookMoveTween = gsap.to(this.bookWrapper.position, {
          paused: true,
          duration: 1,
          x: () => (this.dim.width < 600 ? -1 : -0.18),
          ease: "none",
        });
        let dummyValue = {
          progress: 0,
        };
        this.flipTimeline.fromTo(
          dummyValue,
          { progress: 0 },
          {
            duration: 1,
            progress: 1,
            ease: "none",
            onUpdate: () => {
              this.lastPageBookMoveTween.progress(dummyValue.progress);
            },
          },
          index + 1
        );

        this.flipTimeline.to(
          this.bookWrapper.rotation,
          { duration: 1, y: 0.14, ease: "none" },
          index + 1
        );
        this.flipTimeline.to(
          this.spotLight.position,
          { duration: 1, x: 3, ease: "none" },
          index + 1
        );
        gsap.set(".extraResources", { visibility: "visible" });
        this.flipTimeline.set(
          ".extraResources",
          { pointerEvents: "all" },
          index + 1.5
        );
        this.flipTimeline.from(
          ".extraResources > p",
          {
            duration: 0.5,
            x: 40,
            opacity: 0,
            ease: "none",
          },
          index + 1.5
        );
        let listItems = document.querySelectorAll(".extraResources li");
        listItems.forEach((item, listIndex) => {
          let dur = (listIndex + 1) * 0.075;
          this.flipTimeline.from(
            item,
            { duration: 0.5 - dur, x: 40, ease: "none" },
            index + 1.5 + dur
          );
          this.flipTimeline.from(
            item,
            { duration: 0.4 - dur, opacity: 0, ease: "none" },
            index + 1.5 + dur
          );
        });
      } else {
        this.flipTimeline.to(
          page.rotation,
          { duration: 1, z: Math.PI, ease: "none" },
          index + 1
        );
      }
      for (let i = index; i < this.pages.length; i++) {
        this.flipTimeline.to(
          this.pages[i].position,
          { duration: 1, y: "+=0.01", ease: "none" },
          index
        );
      }
      this.flipTimeline.to(
        this.pagesWrapper.position,
        {
          duration: 1,
          z: -0.005 - index * 0.005,
          ease: "none",
        },
        index
      );
      this.flipTimeline.to(
        this.coverWrapper.position,
        {
          duration: 1,
          z: 0.02 - index * 0.005,
          ease: "none",
        },
        index
      );
    });
  }

  private modelsLoadedCheck = () => {
    if (this.modelsLoaded === 2 && this.texturesLoaded) {
      this.setupPages();
      this.setupNav();
      window.addEventListener("resize", this.resize);
      this.resize();
      this.isActive(true);

      if (!this.SKIP_INTRO) {
        //Loading done animation:
        document.body.classList.add("loaded");
        gsap.to(".loading", { opacity: 0, duration: 0.5 });
        // gsap.to('.logo', {opacity: 0, duration: 0.5});

        let delay = 0.75;

        this.flipTimeline.progress(0.45);
        gsap.from([this.dirLight, this.ambLight, this.spotLight], {
          delay: 0.4 + delay,
          intensity: 0,
          duration: 4,
          ease: "sine.inOut",
        });
        gsap.to(this.dirLight.position, {
          z: 2.68,
          delay: 2 + delay,
          duration: 4,
          ease: "sine.inOut",
        });
        gsap.from(this.cameraLookAtPosition.position, {
          y: 0.75,
          delay: 0.4 + delay,
          duration: 4,
          ease: "power1.inOut",
        });
        gsap.from(this.bookWrapper.position, {
          y: 0,
          delay: 0.4 + delay,
          duration: 6,
          ease: "power1.inOut",
        });
        gsap.fromTo(
          this.cameraWrapper.position,
          { z: 10 },
          {
            z: 0,
            delay: 0.4 + delay,
            duration: 5.5,
            ease: "power1.inOut",
          }
        );
        gsap.to(this.flipTimeline, {
          progress: 0,
          delay: 0.4 + delay,
          duration: 4,
          ease: "slow(0.7, 0.7, false)",
        });
        gsap.from(this.bookWrapper.rotation, {
          z: 0,
          delay: 0.4 + delay,
          duration: 6,
          ease: "power1.inOut",
          onComplete: (args) => {
            this.ON_LANDING_SCREEN = true;
            document.body.addEventListener("click", this.enterBook);
          },
        });
      } else {
        this.enterBook(null as any);
      }
    }
  };

  private uploadTexture = (texture: Texture) => {
    this.renderer.initTexture(texture);
  };

  private setupPageMaterials() {
    let rough = new THREE.TextureLoader().load(
      RoughnessMap,
      this.uploadTexture
    );
    let bump = new THREE.TextureLoader().load(
      RoughnessMap2,
      this.uploadTexture
    );
    let cover = new THREE.TextureLoader().load(
      checkWebP(`images/cover.png`),
      this.uploadTexture
    );
    let coverBack = new THREE.TextureLoader().load(
      checkWebP(`images/back_cover.png`),
      this.uploadTexture
    );
    let useNormalMap = this.renderer.capabilities.maxTextures > 8;
    if (!useNormalMap) {
      console.log(
        "Disabled normalmap because of maxTextureLimit of 8 on this device"
      );
    }
    let normalMap = useNormalMap
      ? new THREE.TextureLoader().load(NormalMap, this.uploadTexture)
      : null;
    // this.menu = new Menu(
    //   this.renderer,
    //   this.pageDatas.length + 2,
    //   normalMap as any,
    //   rough,
    //   bump,
    //   this.uploadTexture,
    //   this.changePage
    // );
    // this.menu.visible = false;

    cover.flipY = false;
    coverBack.flipY = false;
    let normalScale = new Vector2(0.5, 0.5);

    //@todo: figure this out, might give better performance with a lower amount:
    let anisotropy = Math.min(this.renderer.capabilities.getMaxAnisotropy(), 8);
    rough.anisotropy = bump.anisotropy = cover.anisotropy = anisotropy;
    if (normalMap) {
      normalMap.anisotropy = anisotropy;
    }

    this.pageDatas.forEach((page, index) => {
      let mat = new MeshStandardMaterialParallax(
        anisotropy,
        this.renderer,
        {
          transparent: false,
          map: new Texture(),
          morphTargets: true,
          morphNormals: true,
          metalness: 0.07,
          roughness: 0.45,
          roughnessMap: rough,
          metalnessMap: bump,
          normalMap: normalMap,
          premultipliedAlpha: (window as any).Main.PREMULTIPLIEDALPHA,
          normalScale: normalScale,
        },
        this.gui
      );
      mat.addPage(page, index + 1);
      this.pageMaterials.push(mat);
    });

    this.coverMaterial = new MeshStandardMaterial({
      transparent: false,
      map: cover,
      metalness: 0.07,
      roughness: 0.45,
      roughnessMap: rough,
      metalnessMap: bump,
      normalMap: normalMap,
      normalScale: normalScale,
    });
    this.backCoverMaterial = new MeshStandardMaterial({
      transparent: false,
      map: coverBack,
      metalness: 0.07,
      roughness: 0.45,
      roughnessMap: rough,
      metalnessMap: bump,
      normalMap: normalMap,
      normalScale: normalScale,
    });
  }

  public isActive = (value: boolean) => {
    if (!this._isActive && value === true) {
      this.render();
    } else if (this._isActive && value === false) {
      cancelAnimationFrame(this.animationFrame);
    }
    this._isActive = value;
  };

  private offsetX = 0;
  private render = (time = 0) => {
    // this.stats.begin();
    this.animationFrame = requestAnimationFrame(this.render);

    //check rays
    // if (!this.ON_LANDING_SCREEN && this.ENTERED && !this.menu.SMALL_MENU_MODE) {
    //   this.menu.checkIntersection(this.raycaster);
    // }

    if (this.controls) {
      this.controls.update();
    } else {
      this.camera.lookAt(this.cameraLookAtPosition.position);
    }
    this.renderer.render(this.scene, this.camera);
    // this.stats.end();
  };

  private clickHandler = (event: MouseEvent) => {
    //Raycast:
    this.mouse.x = (event.clientX / this.dim.width) * 2 - 1;
    this.mouse.y = -(event.clientY / this.dim.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    // this.menu.clickHandler(this.raycaster);
  };

  private LANDSCAPE_MODE = false;
  private resize = () => {
    //Update renderer:
    this.dim.x = this._parent.clientWidth;
    this.dim.y = this._parent.clientHeight;
    this.renderer.setPixelRatio(
      gsap.utils.clamp(1, 3, window.devicePixelRatio)
    );
    this.renderer.setSize(this.dim.x, this.dim.y);

    this.LANDSCAPE_MODE =
      this.dim.x > this.dim.y && this.dim.y <= 540 && this.dim.x <= 960;
    if (this.LANDSCAPE_MODE) {
      this.cameraWrapper.position.y = 0;
      this.cameraWrapper.position.x = 0;
    }

    this.camera.zoom = 1;
    this.camera.updateProjectionMatrix();

    this.scene.add(this.cornerMarker);
    this.camera.aspect = this.dim.x / this.dim.y;
    this.camera.position.y = 0;
    let fitOffset = this.camera.aspect < 1.25 ? 1 : 0.82;
    if (this.LANDSCAPE_MODE) {
      fitOffset = 0.6;
    }
    let z = this.camera.position.z;
    fitCameraToSelection(
      this.camera,
      [this.cornerMarker],
      fitOffset,
      this.controls
    );
    this.camera.userData.positionZ = this.camera.position.z;

    //Calculate pixel width:
    var vFOV = THREE.MathUtils.degToRad(this.camera.fov);
    var h = 2 * Math.tan(vFOV / 2) * this.camera.position.z;
    var w = h * this.camera.aspect;
    this.bookPixelWidth = (2.22 / w) * this.dim.width;

    if (!this.ENTERED && !this.ENTERING) {
      this.camera.position.y = -6;
    }
    let scale = 1500 / this.bookPixelWidth;
    // this.menu.scale.set(scale, scale, scale);
    // if (!this.LANDSCAPE_MODE && this.dim.x <= 600) {
    //   this.menu.SMALL_MENU_MODE = true;
    //   let px = h * (1 / this.dim.y);
    //   this.menu.position.y = -h / 2 - px * 40;
    //   if (this.ENTERED) {
    //     this.currentViewYOffset = 100;
    //     this.camera.setViewOffset(
    //       this.dim.x,
    //       this.dim.y,
    //       0,
    //       this.currentViewYOffset,
    //       this.dim.x,
    //       this.dim.y
    //     );
    //   }
    // } else {
    //   this.menu.SMALL_MENU_MODE = false;
    //   this.currentViewYOffset = 0;
    //   this.camera.clearViewOffset();
    //   this.menu.position.y = -0.625 - 0.08 * scale;
    // }
    // this.menu.position.x = this.menu.width * scale * -0.5;

    this.scene.remove(this.cornerMarker);

    let progress = this.lastPageBookMoveTween.progress();
    this.lastPageBookMoveTween = gsap.fromTo(
      this.bookWrapper.position,
      {
        immediateRender: false,
        x: 0,
        overwrite: false,
      },
      {
        paused: true,
        overwrite: false,
        immediateRender: false,
        duration: 1,
        x: () =>
          this.dim.width < 600 ? -1.15 * (300 / this.dim.width) : -0.18,
        ease: "none",
      }
    );
    if (progress > 0) {
      this.lastPageBookMoveTween.progress(progress);
    }

    //Update mouse
    this.setPageKill();
    gsap.set(this.draggableElement, {
      left: this.currPageIndex * -this.dim.width,
    });
    gsap.set(this.flipTimeline, {
      progress: this.currPageIndex / (this.pageDatas.length + 1),
    });
    this.draggable.update(true);
    document.documentElement.style.setProperty(
      "--bookPixelWidth",
      `${this.bookPixelWidth}px`
    );

    if (!this.ENTERED) {
      this.camera.position.z = z;
      //Calculate pixel width:
      var vFOV = THREE.MathUtils.degToRad(this.camera.fov);
      var h = 2 * Math.tan(vFOV / 2) * this.camera.position.z;
      var w = h * this.camera.aspect;
      let bookPixelWidth = (2.22 / w) * this.dim.width * 0.5;
      if (bookPixelWidth / this.dim.x > 1.27) {
        let factor = gsap.utils.clamp(0, 2.35, bookPixelWidth / this.dim.x);
        this.camera.zoom = (1 / factor) * 1.2;
        this.camera.updateProjectionMatrix();
      }
    }
  };

  private dragUpdate = () => {
    let page = (this.draggable.x / this.dim.width) * -1;
    if (this.flipTimeline) {
      let progress = page / (this.pageDatas.length + 1);
      // console.log(progress, page);
      this.currPageIndex = gsap.utils.clamp(
        0,
        this.pageDatas.length + 1,
        Math.round(page)
      );
      this.flipTimeline.progress(progress);
    }
  };

  private setCurrentPage = (index: number) => {
    if (index < 0) {
      index = 0;
    } else if (index > this.pages.length + 1) {
      index = this.pages.length + 1;
      this.setPageKill();
      gsap.to(this.flipTimeline, { progress: 1, duration: 0.5 });
    }
    if (index !== this.currPageIndex) {
      this.currPageIndex = index;
      this.setPageKill();
      gsap.to(this.draggableElement, {
        left: index * -this.dim.width,
        duration: 1,
      });
      gsap.to(this.flipTimeline, {
        progress: this.currPageIndex / (this.pageDatas.length + 1),
        duration: 1.5,
        ease: "power3.inOut",
      });
    }
    // this.checkNavArrows();
  };

  private leftAllowed = true;
  private rightAllowed = true;

  private setPageKill = () => {
    gsap.killTweensOf(this.draggableElement);
    gsap.killTweensOf(this.flipTimeline);
    this.draggable.tween?.kill();
  };

  private setupNav() {
    document.addEventListener("keydown", (event: KeyboardEvent) => {
      if (this.ENTERED) {
        if (event.key === "ArrowRight") {
          this.setCurrentPage(this.currPageIndex + 1);
        } else if (event.key === "ArrowLeft") {
          this.setCurrentPage(this.currPageIndex - 1);
        }
      }
    });
  }

  private enterBook = (event: MouseEvent) => {
    event?.preventDefault();
    this.ON_LANDING_SCREEN = false;
    document.body.removeEventListener("click", this.enterBook);
    this.idleTimeline?.kill();
    this.hoverAnimation?.kill();
    let timeline = gsap.timeline({
      onComplete: (args) => {
        this.currPageIndex = 1;
        gsap.set(this.draggableElement, {
          left: this.currPageIndex * -this.dim.width,
        });

        document.body.addEventListener("click", this.clickHandler);
        this.draggable.enable();
        // this.menu.show();

        this.coverBottomBack.visible = false;
        this.camera.zoom = 1;
        this.camera.updateProjectionMatrix();
      },
    });
    // if (this.menu.SMALL_MENU_MODE) {
    //   timeline.fromTo(
    //     this,
    //     { currentViewYOffset: 0 },
    //     {
    //       duration: 1.5,
    //       currentViewYOffset: 100,
    //       onUpdate: () => {
    //         this.camera.setViewOffset(
    //           this.dim.x,
    //           this.dim.y,
    //           0,
    //           this.currentViewYOffset,
    //           this.dim.x,
    //           this.dim.y
    //         );
    //       },
    //     },
    //     1.5
    //   );
    // }
    // timeline.to(
    //   this.camera,
    //   {
    //     zoom: 1,
    //     duration: 1.5,
    //     onUpdate: () => this.camera.updateProjectionMatrix,
    //   },
    //   1.5
    // );
    timeline.to(this, { ambientMoveFactor: 2, duration: 1.5 }, 0);
    timeline.to(this.cover.rotation, { duration: 0.75, z: 0 }, 0);
    timeline.to(
      this.dirLight,
      { intensity: 0.9, duration: 2, ease: "sine.out" },
      1.5
    );
    timeline.to(
      this.dirLight,
      { intensity: 2, duration: 2, ease: "sine.out" },
      2
    );
    timeline.to(
      this.dirLight.position,
      { z: 0, duration: 2, ease: "sine.out" },
      0
    );
    timeline.to(
      this.camera.position,
      { y: 0, duration: 3, ease: "power3.inOut" },
      0
    );
    timeline.to(
      this.cameraWrapper.position,
      { z: 0.5, duration: 1.5, ease: "sine.in" },
      0
    );
    timeline.to(
      this.cameraWrapper.position,
      { z: 0, duration: 1.5, ease: "back.out" },
      1.5
    );
    timeline.to(
      this.flipTimeline,
      {
        progress: 1 / (this.pageDatas.length + 1),
        duration: 4,
        ease: "sine.inOut",
      },
      3.15
    );
    timeline.to(
      this.camera.position,
      {
        z:
          this.camera.position.z +
          (this.camera.userData.positionZ - this.camera.position.z) * 0.33,
        duration: 2,
        ease: "sine.out",
      },
      0
    );
    timeline.to(
      this.camera.position,
      { z: this.camera.userData.positionZ, duration: 3, ease: "power3.inOut" },
      3
    );
    timeline.to(
      this.cameraLookAtPosition.position,
      { y: 0, duration: 2.55, ease: "power3.inOut" },
      0
    );
    timeline.to(
      this.bookWrapper.position,
      { y: 0, duration: 3.1, ease: "back.out(1.4)" },
      0
    );
    timeline.to(
      this.bookWrapper.rotation,
      { z: 0, duration: 3.1, ease: "back.out" },
      0
    );
    timeline.to(this, { xMoveAmount: 0.2, duration: 3 }, 0);
    timeline.to(
      this.groundPlane.material,
      { roughness: 0.34, metalness: 0.7, duration: 2, ease: "sine.out" },
      0
    );
    timeline.set(this, { ENTERED: true });
    this.ENTERING = true;

    if (this.SKIP_INTRO) {
      timeline.progress(1);
    }
    return false;
  };

  private idleTimeline: gsap.core.Timeline;
  private hoverAnimation: gsap.core.Tween;

  private changePage = (newIndex: number) => {
    this.setCurrentPage(newIndex);
  };
}
