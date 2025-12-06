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


const { MongoClient, ServerApiVersion } = require('mongodb');
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
        const usersColl = StyleDecor.collection('users')

        // apis here 
        // add user role 
        app.post('/users', verifyFBToken, async (req, res) => {
            const user = req.body;
            const { email } = user
            if (email) {
                if (email !== req.token_email){
                    return res.status(403).send({message:"forbidden access"})
                }
            }
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
        app.get('/users', verifyFBToken, async (req, res) => {

            const result = await usersColl.find().toArray();
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
