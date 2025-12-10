const express = require('express')
require('dotenv').config();

// middleWares 
const cors = require('cors')
const app = express()
app.use(cors())
app.use(express.json())


// firebase 
const admin = require("firebase-admin");
const serviceAccount = require("./styledecor-firebase-adminsdk.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});


const verifyFBToken = async (req, res, next) => {
    const { authorization } = req.headers;

    if (!authorization) {
        res.status(401).send({ message: 'unAuthorized Access' })
    }

    const token = authorization.split(' ')[1]
    if (!token) {
        res.status(401).send({ message: 'unAuthorized Access' })
    }

    try {
        const decoded = await admin.auth().verifyIdToken(token)
        req.token_email = decoded.email;
        next()
    } catch (error) {
        res.send(error)
    }

}

const port = process.env.PORT || 3000

app.get('/', (req, res) => {
    res.send('Hello World!')
})


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = process.env.URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {

        await client.connect();

        const StyleDecor = client.db('StyleDecor');
        const usersColl = StyleDecor.collection('users');
        const serviceColl = StyleDecor.collection('services')
        const decoratorColl = StyleDecor.collection('decorators')
        const bookingColl = StyleDecor.collection('bookings')

        // apis here 

        //--------user Related apis--------
        // add user role 
        app.post('/users', async (req, res) => {
            const user = req.body;
            console.log(user);
            const isExist = await usersColl.findOne({ email: user?.email })
            if (isExist) {
                res.send({ message: "user already exist" })
            }
            if (!isExist) {
                const result = await usersColl.insertOne(user)
                res.send(result)
            }
        })

        // get User role 
        app.get('/users', async (req, res) => {

            const result = await usersColl.find().toArray();
            res.send(result)
        })

        //get a single user
        app.get('/users/:email', async (req, res) => {
            const { email } = req.params;
            const result = await usersColl.findOne({ email: email })
            res.send(result)
        })

        //update user role
        app.patch('/users/:id', async (req, res) => {
            const { id } = req.params;
            const role = req.body;
            const update = {
                $set: role
            }
            const result = await usersColl.updateOne({ _id: new ObjectId(id) }, update);
            res.send(result)
        })

        //--------servie Related apis--------
        //get all services
        app.get('/services', async (req, res) => {
            const result = await serviceColl.find().toArray()
            res.send(result)
        })

        //get a single service
        app.get('/services/:id', async (req, res) => {
            const { id } = req.params;
            const result = await serviceColl.findOne({ _id: new ObjectId(id) })
            res.send(result)
        })

        // post a serviec 
        app.post('/services', async (req, res) => {
            const serviec = req.body;
            const result = await serviceColl.insertOne(serviec);
            res.send(result)
        })
        //update a service
        app.patch('/services/:id', async (req, res) => {
            const { id } = req.params;
            const updateInfo = req.body;
            const update = {
                $set: updateInfo
            }
            const result = await serviceColl.updateOne({ _id: new ObjectId(id) }, update);
            res.send(result)
        })

        //delete a servies
        app.delete('/services/:id', async (req, res) => {
            const { id } = req.params;
            const result = await serviceColl.deleteOne({ _id: new ObjectId(id) })
            res.send(result)
        })

        //--------decorators Related apis--------
        //get all decorators
        app.get('/decorators', async (req, res) => {
            const result = await decoratorColl.find().toArray();
            res.send(result)
        })

        //--------bookings Related apis--------
        //get bookings
        app.get('/bookings', async (req, res) => {
            const result = await bookingColl.find().toArray()
            res.send(result)
        })

        //add booking in bookings
        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            const result = await bookingColl.insertOne(booking);
            res.send(result)
        })



        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
