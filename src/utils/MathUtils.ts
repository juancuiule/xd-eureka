import { Box3, Object3D, PerspectiveCamera, Vector3 } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

export function randomInteger(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function checkWebP(filename: string) {
  return (window as any).Main.WEBP_SUPPORTED && false
    ? filename.replace(".png", ".webp").replace("images/", "images_webp/")
    : filename;
}
export function fitCameraToSelection(
  camera: PerspectiveCamera,
  selection: Object3D[],
  fitOffset = 1,
  controls?: OrbitControls
) {
  const box = new Box3();

  for (const object of selection) box.expandByObject(object);

  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());

  const maxSize = Math.max(size.x, size.y, size.z);
  const fitHeightDistance =
    maxSize / (2 * Math.atan((Math.PI * camera.fov) / 360));
  const fitWidthDistance = fitHeightDistance / camera.aspect;
  const distance = fitOffset * Math.max(fitHeightDistance, fitWidthDistance);

  const target = controls ? controls.target : new Vector3(0, 0, 0);
  const direction = target
    .clone()
    .sub(camera.position)
    .normalize()
    .multiplyScalar(distance);

  camera.near = distance / 10;
  camera.far = distance * 10;
  camera.updateProjectionMatrix();

  camera.position.copy(target).sub(direction);
  if (controls) {
    controls.maxDistance = distance * 10;
    controls.target.copy(center);
    controls.update();
  }
}

export function getRandomIntsFromRange(count: number, range: number) {
  let i = 0;
  let stack = [];
  let randomImages: number[] = [];

  // Generate stack
  for (i; i < range; i++) {
    stack.push(i + 1);
  }

  // Add random from stack
  i = 0;
  let tempTotal = range - 1;
  let randomInt;
  for (i; i < count; i++) {
    randomInt = randomInteger(0, tempTotal);
    randomImages.push(stack[randomInt]);

    stack.splice(randomInt, 1);

    tempTotal--;
  }

  return randomImages;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function degreesToRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function radiansToDegrees(radians: number) {
  return (radians * 180) / Math.PI;
}

/** This method will calculate how big a circle is needed to make the square fit in it */
export const squareToCircle = (width: number) => Math.SQRT2 * width

/** This method will calculate the largest square that can fit in the circle */
export const circleToSquare = (radius: number) => Math.SQRT1_2 * radius
