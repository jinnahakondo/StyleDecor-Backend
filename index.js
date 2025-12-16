const express = require('express')
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express()

// middleWares 
const cors = require('cors')
app.use(cors())
app.use(express.json())


// firebase 
const admin = require("firebase-admin");
const serviceAccount = require("./styledecor-firebase-adminsdk.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});


// traking id generate 
function generateTrackingId() {
    const time = Date.now();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `STR-${time}-${rand}`;
}


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
        const assignedBookingColl = StyleDecor.collection('assignedBookings')
        const paymentColl = StyleDecor.collection('payments')
        const trackingColl = StyleDecor.collection('trackings')

        // apis here 

        //--------user Related apis--------
        // add user role 
        app.post('/users', async (req, res) => {
            const user = req.body;
            // console.log(user);
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
        app.patch('/users/:email', async (req, res) => {
            const { email } = req.params;
            const { role } = req.body;
            const update = {
                $set: { role }
            }

            const result = await usersColl.updateOne({ email }, update);
            res.send(result)

        })

        //--------servie Related apis--------
        //get all services
        app.get('/services', async (req, res) => {
            const result = await serviceColl.find().sort({ createdAt: -1 }).toArray()
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

        //-------assigned bookings Related apis--------
        //get assigned bookings
        app.get('/assigned-bookings/:email', async (req, res) => {
            const { email } = req.params;
            console.log('from assigned project',email);
            const result = await assignedBookingColl.find({ decoratorEmail: email }).toArray();
            res.send(result)
        })

        //get assigned bookings today
        app.get('/assigned-bookings/today/:email', async (req, res) => {
            const { email } = req.params;
            const query = { decoratorEmail: email, bookingDate: new Date().toISOString().split('T')[0] }
            const result = await assignedBookingColl.find(query).toArray();
            res.send(result)
        })
        //update assigned bookings 
        app.patch('/assigned-bookings/:id', async (req, res) => {
            const { id } = req.params;

            const { status } = req.body;
            const update = {
                $set: { status }
            }
            const result = await assignedBookingColl.updateOne({ _id: new ObjectId(id) }, update)
            res.send(result)
        })

        //post assigned bookings
        app.post('/assigned-bookings', async (req, res) => {
            const assignedBookingInfo = req.body;
            // console.log(assignedBookingInfo);
            const result = await assignedBookingColl.insertOne(assignedBookingInfo)
            res.send(result)
        })
        //get top decorators
        app.get('/decorators/home', async (req, res) => {
            const result = await decoratorColl.find().limit(5).toArray();
            res.send(result)
        })

        //get all decorators
        app.get('/decorators', async (req, res) => {
            const { category, district } = req.query;
            if (category && district) {
                const query = { category, district, status: 'approved' }
                const result = await decoratorColl.find(query).toArray();
                return res.send(result)
            }
            const query = { status: { $in: ['pending', 'approved'] } }
            const result = await decoratorColl.find(query).sort().toArray();
            res.send(result)
        })

        //add a decorator
        app.post('/decorators', async (req, res) => {
            const newDecorator = req.body;
            newDecorator.status = 'pending';
            const result = await decoratorColl.insertOne(newDecorator);
            res.send(result)
        })
        //update decorator
        app.patch('/decorators/:email', async (req, res) => {
            const { email } = req.params;
            const { status } = req.body;
            const update = {
                $set: { status }
            }
            const result = await decoratorColl.updateOne({ email }, update)
            res.send(result)
        })

        //asign decorator 
        app.patch('/asign/decorator/:id', async (req, res) => {
            const { id } = req.params;
            const { workingStatus } = req.body;
            const update = {
                $set: {
                    workingStatus
                }
            }
            const result = await decoratorColl.updateOne({ _id: new ObjectId(id) }, update)
            res.send(result)
        })

        //delete a decorator
        app.delete('/decorators/:email', async (req, res) => {
            const { email } = req.params;
            const result = await decoratorColl.deleteOne({ email })
            res.send(result)
        })

        //--------bookings Related apis--------
        //get bookings
        app.get('/bookings', async (req, res) => {
            const result = await bookingColl.find({ paymentStatus: { $nin: ["pending"] } }).toArray()
            res.send(result)
        })

        //get a single bookings
        app.get('/bookings/:email', async (req, res) => {
            const { email } = req.params;
            const result = await bookingColl.find({ customerEmail: email }).toArray()
            res.send(result)
        })

        //add booking in bookings
        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            booking.trakingId = generateTrackingId();
            const result = await bookingColl.insertOne(booking);
            res.send(result)
        })

        //delete a single booking
        app.delete('/bookings/delete/:id', async (req, res) => {
            const { id } = req.params;
            const result = await bookingColl.deleteOne({ _id: new ObjectId(id) })
            res.send(result)
        })

        //update a booking
        app.patch('/bookings/:id', async (req, res) => {
            const { id } = req.params;
            const updateInfo = req.body;
            const update = {
                $set: { ...updateInfo }
            }
            const result = await bookingColl.updateOne({ _id: new ObjectId(id) }, update)
            res.send(result)
        })

        //update a booking status
        app.patch('/bookings/update-status/:serviceId', async (req, res) => {
            const { serviceId } = req.params;
            const { status } = req.body;
            const update = {
                $set: { status }
            }
            const result = await bookingColl.updateOne({ serviceId }, update)
            res.send(result)
        })

        //--------PAYMENT RELATED APIS--------
        // checkout session 
        app.post('/create-checkout-session', async (req, res) => {
            const serviceInfo = req.body;
            const amount = Number(serviceInfo.price) * 100;
            const session = await stripe.checkout.sessions.create({
                line_items: [
                    {
                        price_data: {
                            currency: 'bdt',
                            unit_amount: amount,
                            product_data: {
                                name: serviceInfo?.title,
                                description: serviceInfo.description,
                                images: [serviceInfo?.image]

                            },
                        },
                        quantity: 1,
                    }

                ],
                metadata: {
                    serviceName: serviceInfo?.title,
                    serviceId: serviceInfo._id,
                    trakingId: serviceInfo.trakingId
                },
                mode: 'payment',
                customer_email: serviceInfo.customerEmail,
                success_url: `${process.env.STYLEDECOR_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.STYLEDECOR_DOMAIN}/dashboard/my-bookings`
            })
            res.send(session.url)
        })

        // payment success 
        app.patch('/payment-success', async (req, res) => {
            const { sessionId } = req.body;
            const session = await stripe.checkout.sessions.retrieve(sessionId);
            const trackingId = session.metadata.trakingId;
            const transectionId = session.payment_intent;

            // check that is already paid?
            const alreadyPaid = await paymentColl.findOne({ transectionId })
            if (alreadyPaid) {
                return res.send({ status: "already paid" })
            }
            if (session.payment_status === 'paid') {
                const serviceId = session.metadata.serviceId;
                const update = {
                    $set: {
                        transectionId,
                        paymentStatus: 'paid',
                        paid_at: new Date(),
                    }
                }

                const serviceUpdateResult = await bookingColl.updateOne({ _id: new ObjectId(serviceId) }, update)
                // console.log(serviceUpdateResult);

                //payments info
                const paymentInfo = {
                    amount: session.amount_total / 100,
                    currency: session.currency,
                    customerEmail: session.customer_email,
                    serviceId: session.metadata.serviceId,
                    serviceName: session.metadata.serviceName,
                    transectionId: session.payment_intent,
                    paymentStatus: session.payment_status,
                    paidAt: new Date()
                }
                const paymentRes = await paymentColl.insertOne(paymentInfo)

                res.send({ serviceUpdateResult, paymentRes })
            }
        })

        //payment history
        app.get('/payment-history/:email', async (req, res) => {
            const { email } = req.params;
            const result = await paymentColl.find({ customerEmail: email }).toArray()
            res.send(result)
        })

        //--------trackings related apis------
        // get trakckings 
        app.get('trackings/:bookingId', async (req, res) => {
            const { bookingId } = req.params;
            const result = await trackingColl.find({ serviceId: bookingId }).toArray()
            res.send(result)
        })

        //add trackings
        app.post('/trackings', async (req, res) => {
            const newTracking = req.body;
            const result = await trackingColl.insertOne(newTracking);
            res.send(result)
        })

        //update trackings
        app.patch('/trackings/:id', async (req, res) => {
            const { id } = req.params;
            const { status } = req.body;
            const update = { $addToSet: { trackingStatus } }
            const result = await trackingColl.updateOne({ _id: new ObjectId(id) }, update)
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
