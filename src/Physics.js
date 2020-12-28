const vec3 = glMatrix.vec3;
const GRAVITY = [0, -9.82, 0];

export default class Physics {

    constructor() {
        this.loaded = false;
    }

    async init() {
        const self = this;
        return Ammo().then( function (Ammo) {
            self.Ammo = Ammo;
                    
            // Bullet-interfacing code
            let collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
            let dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
            let overlappingPairCache = new Ammo.btDbvtBroadphase();
            let solver = new Ammo.btSequentialImpulseConstraintSolver();
            
            self.objects = [];
            self.tmpTransform = new Ammo.btTransform();
            self.dynamicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, overlappingPairCache, solver, collisionConfiguration);
            self.dynamicsWorld.setGravity(new Ammo.btVector3(...GRAVITY));
        })
    }
    

    applyForces() {
        const Ammo = this.Ammo;
        for(const node of this.objects) {
            if (node.dynamic == 1) {
                const body = node.body;
                
                
                const currentVelocity = body.getLinearVelocity();
                const currentVelocityVec = [currentVelocity.x(), currentVelocity.y(), currentVelocity.z()];
                const nextSpeed = vec3.add(vec3.create(), currentVelocityVec, node.acceleration);
                
                /*
                if (vec3.length(nextSpeed) > node.maxSpeed) {
                    vec3.negate(node.acceleration, node.acceleration)
                }
                */
                this.setBodyRotation(body, node.rotation)
                body.applyImpulse(new Ammo.btVector3(...node.acceleration), new Ammo.btVector3(0,0,0));

                // apply jump force after speed
                if (node.jumpForce) {
                    body.applyImpulse(new Ammo.btVector3(...node.jumpForce), new Ammo.btVector3(0,0,0));
                }

            }
        }
    }

    update(dt) {
        this.applyForces();
        this.dynamicsWorld.stepSimulation(dt, 2);
        for(const node of this.objects) {
            if (node.dynamic == 1) {
                this.updateNodePosition(node);
                //this.updateNodeRotaton(node);
                node.updateMatrix();
            }

            node.colliding = false;
        }

        this.detectCollision();
    }


    detectCollision() {

        let dispatcher = this.dynamicsWorld.getDispatcher();
        let numManifolds = dispatcher.getNumManifolds();
    
        for ( let i = 0; i < numManifolds; i ++ ) {
    
            let contactManifold = dispatcher.getManifoldByIndexInternal( i );

            let rb0 = Ammo.castObject( contactManifold.getBody0(), Ammo.btRigidBody );
            let rb1 = Ammo.castObject( contactManifold.getBody1(), Ammo.btRigidBody );

            let node0 = rb0.node;
            let node1 = rb1.node;

            if ( ! node0 && ! node1 ) continue;
            
            let tag0 = node0 ? node0.tag : "none";
            let tag1 = node1 ? node1.tag : "none";

            let numContacts = contactManifold.getNumContacts();
    
            for ( let j = 0; j < numContacts; j++ ) {
    
                let contactPoint = contactManifold.getContactPoint( j );
                let distance = contactPoint.getDistance();
    
                if( distance > 0.0 ) continue;

                node0.colliding = true;
                node1.colliding = true;

                if (tag0 == "bullet" && tag1 == "hittable") {
                    node1.destroy()
                    node0.getHit();
                }

                if (tag0 == "hittable" && tag1 == "bullet") {
                    node1.destroy()
                    node0.getHit();
                }
    
            }
    
    
        }
    
    }

    
    setBodyPosition(body, pos) {
        const Ammo = this.Ammo;
        let transform = body.getWorldTransform();
        transform.setOrigin(new Ammo.btVector3(...pos));
    }

    setBodyRotation(body, q) {
        const Ammo = this.Ammo;
        let transform = body.getWorldTransform();
        transform.setRotation(new Ammo.btQuaternion(...q));
    }

    updateNodePosition(node) {
        const body = node.body;
        body.getMotionState().getWorldTransform(this.tmpTransform)

        const pos = this.tmpTransform.getOrigin();
        node.translation[0] = pos.x();
        node.translation[1] = pos.y();
        node.translation[2] = pos.z();
    }

    updateNodeRotaton(node) {
        const body = node.body;
        body.getMotionState().getWorldTransform(this.tmpTransform)

        const rot = this.tmpTransform.getRotation();
        node.rotation[0] = rot.x();
        node.rotation[1] = rot.y();
        node.rotation[2] = rot.z();
        node.rotation[3] = rot.w();
    }

    createBody(node) {
        const Ammo = this.Ammo;
        let startTransform = new Ammo.btTransform();
        startTransform.setIdentity();

        let mass = node.dynamic;
        let localInertia = new Ammo.btVector3(0, 0, 0);
        let shape;
        if (node.isHumanoid) {
            shape = new Ammo.btCylinderShape(new Ammo.btVector3(...node.scale));
        } else {
            shape = new Ammo.btBoxShape(new Ammo.btVector3(...node.scale));
        }

        shape.calculateLocalInertia(mass, localInertia);
    
        let myMotionState = new Ammo.btDefaultMotionState(startTransform);
        let rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, myMotionState, shape, localInertia);
        let body = new Ammo.btRigidBody(rbInfo);

        this.setBodyPosition(body, node.translation);
        this.setBodyRotation(body, node.rotation);
        
        if (node.isHumanoid) {
            body.setFriction(.5);
            body.setDamping(.65, 1);            
        } else {
            body.setFriction(1.1);
        }

        //body.setGravity(new Ammo.btVector3(...GRAVITY))
        
        body.setActivationState(4) // DISABLE_DEACTIVATION

        this.dynamicsWorld.addRigidBody(body);

        node.body = body;
        body.node = node;

        this.objects.push(node);
    }

    addNode(node) {
        if (node.dynamic !== null) {
            this.createBody(node);
        }
    }

    removeNode(node) {
        const index = this.objects.indexOf(node);
        if (index >= 0) {
            this.objects.splice(index, 1);
            node.parent = null;
        }
    }

    prepareWorld(scene) {
        for (const node of scene.nodes) {
            this.addNode(node);
        }
    }

}