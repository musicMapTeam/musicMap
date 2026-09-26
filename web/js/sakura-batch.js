/**
 * Collapse repeated, static render objects while keeping their nearest action.
 * Call once after building the world and before rendering. Geometry/material
 * ownership stays with the scene; batching never disposes source resources.
 * Counts describe visible Mesh objects, including existing instance batches,
 * rather than GPU calls across the shadow and post-processing passes.
 */
export function batchStaticMeshes(THREE, world, { exclude = [] } = {}) {
  const excluded = new Set(exclude);
  const groups = new Map();
  let before = 0;
  world.traverseVisible(object => { if (object.isMesh) before++; });
  world.updateMatrixWorld(true);
  const inverseWorld = new THREE.Matrix4().copy(world.matrixWorld).invert();

  function collect(object, inheritedAction = null) {
    if (!object.visible || excluded.has(object) || object.userData.dynamic === true) return;
    const effectiveAction = object.userData.action || inheritedAction;
    // Keep transform parents in place, including any excluded children.
    if (object.isMesh && object.children.length === 0 && !object.isInstancedMesh && !object.isSkinnedMesh && !Array.isArray(object.material)) {
      const actionKey = effectiveAction
        ? JSON.stringify(Object.keys(effectiveAction).sort().map(key => [key, effectiveAction[key]]))
        : 'none';
      const key = [object.geometry.uuid, object.material.uuid, Number(object.castShadow), Number(object.receiveShadow), actionKey].join('|');
      let entry = groups.get(key);
      if (!entry) {
        entry = { meshes: [], geometry: object.geometry, material: object.material,
          castShadow: object.castShadow, receiveShadow: object.receiveShadow, action: effectiveAction };
        groups.set(key, entry);
      }
      entry.meshes.push(object);
    }
    object.children.forEach(child => collect(child, effectiveAction));
  }
  collect(world);

  let batches = 0;
  let removed = 0;
  const matrix = new THREE.Matrix4();
  for (const entry of groups.values()) {
    if (entry.meshes.length < 3) continue;
    const batch = new THREE.InstancedMesh(entry.geometry, entry.material, entry.meshes.length);
    batch.name = `static-batch-${batches + 1}`;
    batch.castShadow = entry.castShadow;
    batch.receiveShadow = entry.receiveShadow;
    if (entry.action) batch.userData.action = entry.action;
    entry.meshes.forEach((object, index) => {
      matrix.multiplyMatrices(inverseWorld, object.matrixWorld);
      batch.setMatrixAt(index, matrix);
    });
    batch.instanceMatrix.needsUpdate = true;
    batch.computeBoundingSphere();
    entry.meshes.forEach(object => object.removeFromParent());
    world.add(batch);
    removed += entry.meshes.length;
    batches++;
  }
  return { before, after: before - removed + batches, batches };
}
