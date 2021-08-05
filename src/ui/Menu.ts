import {gsap} from 'gsap';
import {
    Group,
    Mesh,
    MeshBasicMaterial,
    MeshStandardMaterial,
    PlaneBufferGeometry,
    Raycaster,
    Texture,
    WebGLRenderer
} from "three";
import * as THREE from "three";
// @ts-ignore
import Mask1 from "~/assets/images/mask1.png";
// @ts-ignore
import Mask2 from "~/assets/images/mask2.png";
// @ts-ignore
import Mask3 from "~/assets/images/mask3.png";
import {checkWebP} from "~/utils/MathUtils";

export class Menu extends Group {
    get SMALL_MENU_MODE(): boolean {
        return this._SMALL_MENU_MODE;
    }

    set SMALL_MENU_MODE(value: boolean) {
        if (this._SMALL_MENU_MODE !== value) {
            this._SMALL_MENU_MODE = value;
            this.activeHitMeshes = value ? this.hitMeshesNested : this.hitMeshes;
            this.activeScale = this._SMALL_MENU_MODE ? 1 : 2;
            this.activeScaleTo = this._SMALL_MENU_MODE ? 0.75 : 1;
            // this.buttons[this.hoverIndex].children[0].scale.set(this.activeScale, this.activeScale, this.activeScale);
            this.updateActiveIndex(this._currPageIndex, true);
        }

    }

    public width: number;
    private hitMeshes: Mesh[] = [];
    private hitMeshesNested: Mesh[] = [];
    private activeHitMeshes: Mesh[] = this.hitMeshes;
    private intersections: THREE.Intersection[] = [];
    private renderer: WebGLRenderer;
    private buttons: Group[] = [];
    private groupWrapper = new Group();

    private activeIndex = -1;
    private hoverIndex = -1;
    private changePage: (index: number) => void;
    private alphaMasks: Texture[];
    private hoverMaskTimeline: gsap.core.Timeline = null;

    private _SMALL_MENU_MODE = false;

    public ENABLED = false;

    private activeScale = 2;
    private activeScaleTo = 1;
    private _currPageIndex: number = 1;

    constructor(renderer: WebGLRenderer, pages, normalMap: Texture, roughness: Texture, metalnessMap: Texture, uploadTexture: (texture: Texture) => void, changePage: (index: number) => void) {
        super();
        this.renderer = renderer;
        this.changePage = changePage;
        this.add(this.groupWrapper);
        let geom = new PlaneBufferGeometry(0.1, 0.1);

        let alphaMask1 = new THREE.TextureLoader().load(Mask1, uploadTexture);
        let alphaMask2 = new THREE.TextureLoader().load(Mask2, uploadTexture);
        let alphaMask3 = new THREE.TextureLoader().load(Mask3, uploadTexture);
        this.alphaMasks = [alphaMask1, alphaMask2, alphaMask3];

        let hitMat = new MeshBasicMaterial({color: 0xff2080, depthWrite: false});
        for (let i = 0; i < pages; i++) {
            let buttonGroup = new THREE.Group();
            buttonGroup.userData.index = i;
            let hitMesh = new Mesh(geom, hitMat);
            hitMesh.scale.set(0.4, 1, 0.4);
            hitMesh.position.x = i * (0.1 * 0.22);
            hitMesh.position.x = i * (0.1 * 0.2) + (i * 0.02);
            hitMesh.userData.index = i;
            hitMesh.visible = false;
            this.hitMeshes.push(hitMesh);
            this.add(hitMesh);

            let tex = new THREE.TextureLoader().load(checkWebP(`images/previews/0${i}.png`), uploadTexture);
            let mesh = new Mesh(geom, new MeshStandardMaterial({
                map: tex, alphaMap: alphaMask1, normalMap: normalMap, roughnessMap: roughness,
                metalnessMap: metalnessMap,
                metalness: 0.07,
                opacity: 0.6,
                roughness: 0.45, depthWrite: false, transparent: true
            }));



            buttonGroup.add(mesh);

            let tex2 = new THREE.TextureLoader().load(checkWebP(`images/previews/text/0${i}.png`), uploadTexture);
            let textMesh = new Mesh(geom, new MeshBasicMaterial({
                map: tex2,
                depthWrite: false,
                transparent: true,
                opacity: 0
            }));
            textMesh.scale.set(1.5, 1.5, 1.5);
            textMesh.rotation.z = -1;
            buttonGroup.add(textMesh);
            mesh.userData.index = textMesh.userData.index = i;
            buttonGroup.scale.set(0.2, 0.2, 0.2);
            buttonGroup.position.x = i * (0.1 * 0.2) + (i * 0.02);

            let hitMesh2 = new Mesh(geom, hitMat);
            if (i === this._currPageIndex) {
                hitMesh2.scale.set(1.5, 1.5, 1);
            } else {
                hitMesh2.scale.set(2, 2, 1);
            }
            hitMesh2.userData.index = i;
            buttonGroup.add(hitMesh2);
            hitMesh2.visible = false;
            this.hitMeshesNested.push(hitMesh2);
            this.groupWrapper.add(buttonGroup);
            this.buttons.push(buttonGroup);
        }
        this.width = (pages - 1) * (0.1 * 0.2) + ((pages - 2) * 0.02);
        // this._currPageIndex = 1;
    }

    public show = () => {
        this.visible = true;
        for (let i = 0; i < this.buttons.length; i++) {
            const button = this.buttons[i];
            // @ts-ignore
            gsap.from(button.children[0].material, {opacity: 0, duration: 0.5, delay: i * 0.1});
            gsap.from(button.position, {x: '-= 0.1', duration: 0.5, delay: i * 0.08, ease: 'back.out'});
            gsap.from(button.scale, {
                x: 0,
                y: 0,
                z: 0,
                // y: '-=0.05',
                ease: 'back.out',
                duration: 0.5,
                delay: i * 0.08,
                onComplete: i === this.buttons.length - 1 ? () => {
                    this.ENABLED = true;
                } : undefined
            });
        }
    }

    checkIntersection(raycaster: Raycaster) {
        raycaster.intersectObjects(this.hitMeshes, false, this.intersections);
        // console.log(this.intersections);
        if (this.intersections.length > 0) {
            // console.log(this.intersections[0]);
            let newIndex = this.intersections[0].object.userData.index;
            this.setHoverIndex(newIndex);
        } else {
            this.setHoverIndex(-1);
            if (this.activeIndex !== -1) {
                // let index = this.activeIndex;
                // this.activeIndex = -1;
                // this.setActiveIndex(index);
            }
        }
        this.intersections.length = 0;
    }

    setHoverIndex = (newIndex: number, instant = false) => {
        if (!this.ENABLED && instant === false) {
            return;
        }
        let dur = instant ? 0 : 0.3;
        let rotationDur = instant ? 0 : 0.3;
        if (newIndex !== this.hoverIndex) {
            if (this.hoverIndex !== -1) {
                this.hoverMaskTimeline?.kill();
                let target = this.buttons[this.hoverIndex];
                gsap.to(target.scale, {duration: dur, x: 0.2, y: 0.2, z: 0.2});
                // @ts-ignore
                gsap.to(target.children[1].material, {opacity: 0, duration: dur});
                gsap.to(target.children[1].rotation, {z: -1, duration: dur});
                gsap.to(target.children[0].rotation, {x: 0, duration: dur});

                if (this._currPageIndex === this.hoverIndex) {
                    // @ts-ignore
                    gsap.to(target.children[0].material, {opacity: 1, duration: dur});
                    gsap.to(target.children[0].scale, {
                        duration: dur,
                        x: this.activeScale,
                        y: this.activeScale,
                        z: this.activeScale
                    });
                } else {

                    // @ts-ignore
                    gsap.to(target.children[0].material, {opacity: 0.6, duration: dur});
                }
            }
            /*            if (this.hoverIndex !== this.activeIndex) {
                            let target = this.buttons[this.activeIndex];
                            gsap.to(target.scale, {duration: dur, x: 0.2, y: 0.2, z: 0.2});
                            // @ts-ignore
                            gsap.to(target.children[1].material, {opacity: 0, duration: dur});
                            gsap.to(target.children[1].rotation, {z: -1, duration: dur});
                            gsap.to(target.children[0].rotation, {x: 0, duration: dur});
                        }*/
            this.hoverIndex = newIndex;
            if (this.hoverIndex !== -1) {
                let targetNew = this.buttons[this.hoverIndex];

                this.hoverMaskTimeline?.kill();

                // @ts-ignore
                targetNew.children[0].material.alphaMap = this.alphaMasks[0];
                if (this._currPageIndex === this.hoverIndex) {
                    gsap.to(targetNew.children[0].scale, {duration: dur, x: 1, y: 1, z: 1});
                } else {
                    // @ts-ignore
                    this.hoverMaskTimeline = gsap.timeline({repeat: -1});
                    // @ts-ignore
                    this.hoverMaskTimeline.set(targetNew.children[0].material, {alphaMap: this.alphaMasks[1]}, 0.12);
                    // @ts-ignore
                    this.hoverMaskTimeline.set(targetNew.children[0].material, {alphaMap: this.alphaMasks[2]}, 0.28);
                    // @ts-ignore
                    this.hoverMaskTimeline.set(targetNew.children[0].material, {alphaMap: this.alphaMasks[0]}, 0.45);
                }

                // @ts-ignore
                gsap.to(targetNew.children[1].material, {opacity: 1, duration: dur});
                // @ts-ignore
                gsap.to(targetNew.children[0].material, {opacity: 1, duration: dur});


                gsap.fromTo(targetNew.children[1].rotation, {z: -1}, {z: 0, duration: rotationDur});
                gsap.to(targetNew.children[0].rotation, {x: -0.1, duration: rotationDur});
                gsap.to(targetNew.scale, {
                    duration: dur,
                    x: this.activeScaleTo,
                    y: this.activeScaleTo,
                    z: this.activeScaleTo
                });
            }
            let width = 0.1 * 0.2;
            for (let i = 0; i < this.buttons.length; i++) {
                if (i === this.hoverIndex || this.hoverIndex === -1) {
                    width = 0;
                } else {
                    if (i < this.hoverIndex) {
                        width = 0.1 * -0.5 * this.activeScaleTo;
                    } else {
                        width = 0.1 * 0.5 * this.activeScaleTo;
                    }
                }
                gsap.to(this.buttons[i].position, {duration: dur, x: i * (0.1 * 0.2) + (i * 0.02) + width})
            }
        }
    }

    public clickHandler = (raycaster: Raycaster) => {
        if (!this.ENABLED) {
            return;
        }
        raycaster.intersectObjects(this.activeHitMeshes, false, this.intersections);
        // console.log(this.intersections);
        if (this.intersections.length > 0) {
            let newIndex = this.intersections[0].object.userData.index;
            this.changePage(newIndex);
            // this.setActiveIndex(newIndex);
        }
        this.intersections.length = 0;
    }


    updateActiveIndex(currPageIndex: number, instant = false) {
        // this._currPageIndex = currPageIndex;
        if (this.SMALL_MENU_MODE) {
            this.setHoverIndex(currPageIndex, instant);
        }
        if (this._currPageIndex !== currPageIndex) {
            let dur = instant ? 0 : 0.3;
            // @ts-ignore
            gsap.to(this.buttons[this._currPageIndex].children[0].material, dur, {opacity: 0.6});
            gsap.to(this.buttons[this._currPageIndex].children[0].scale, dur, {x: 1, y: 1, z: 1});
            gsap.to(this.hitMeshesNested[this._currPageIndex].scale, dur, {x: 2, y: 2, z: 1});
            this._currPageIndex = currPageIndex;
            if (this._currPageIndex !== this.hoverIndex) {
                // @ts-ignore
                gsap.to(this.buttons[currPageIndex].children[0].material, dur, {opacity: 1});
                gsap.to(this.buttons[currPageIndex].children[0].scale, dur, {
                    x: this.activeScale,
                    y: this.activeScale,
                    z: this.activeScale
                });
            } else {
                gsap.to(this.hitMeshesNested[currPageIndex].scale, dur, {x: 1.5, y: 1.5, z: 1});
                gsap.killTweensOf(this.buttons[currPageIndex].children[1].rotation);
                gsap.to(this.buttons[currPageIndex].children[1].rotation, {z: 0.33, duration: dur});
                this.hoverMaskTimeline?.kill();
            }
        }
    }
}