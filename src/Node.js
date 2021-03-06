const vec3 = glMatrix.vec3;
const mat4 = glMatrix.mat4;
const quat = glMatrix.quat;

export default class Node {

    constructor(options = {}) {
        this.translation = options.translation
            ? vec3.clone(options.translation)
            : vec3.fromValues(0, 0, 0);
        this.rotation = options.rotation
            ? quat.clone(options.rotation)
            : quat.fromValues(0, 0, 0, 1);
        this.scale = options.scale
            ? vec3.clone(options.scale)
            : vec3.fromValues(1, 1, 1);
        this.matrix = options.matrix
            ? mat4.clone(options.matrix)
            : mat4.create();

        if (options.matrix) {
            this.updateTransform();
        } else if (options.translation || options.rotation || options.scale) {
            this.updateMatrix();
        }

        this.name = options.name || null;
        this.camera = options.camera || null;
        this.mesh = options.mesh || null;

        this.colliding = false;
        this.destroyed = false;

        if (options.extras) {
            this.dynamic = options.extras.dynamic; // 0 or 1   if null dont give it physics at all
        }

        this.children = [...(options.children || [])];
        for (const child of this.children) {
            child.parent = this;
        }
        this.parent = null;

        //console.log(this.name, this.dynamic, this.scale, this.translation, this.mesh)
    }

    updateTransform() {
        mat4.getRotation(this.rotation, this.matrix);
        mat4.getTranslation(this.translation, this.matrix);
        mat4.getScaling(this.scale, this.matrix);
    }

    updateMatrix() {
        mat4.fromRotationTranslationScale(
            this.matrix,
            this.rotation,
            this.translation,
            this.scale);
    }

    getGlobalMatrix() {
        const mat = mat4.clone(this.matrix);
        let parent = this.parent;
        while (parent) {
            mat4.mul(mat, parent.matrix, mat);
            parent = parent.parent;
        }
        
        return mat;
    }

    addChild(node) {
        this.children.push(node);
        node.parent = this;
    }

    removeChild(node) {
        const index = this.children.indexOf(node);
        if (index >= 0) {
            this.children.splice(index, 1);
            node.parent = null;
        }
    }

    clone() {
        return new Node({
            ...this,
            children: this.children.map(child => child.clone()),
        });
    }


    destroy() {
        if (this.scene) {
            this.scene.removeNode(this);
        }

        if (this.physics) {
            this.physics.removeNode(this);
        }

        for (const child of this.children) {
            child.destroy();
        }

        if (this.parent) {
            const index = this.parent.children.indexOf(this);
            if (index >= 0) {
                this.parent.children.splice(index, 1);
                this.parent = null;
            }
        }
    }

}