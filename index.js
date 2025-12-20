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
        return res.status(401).send({ message: 'unAuthorized Access' })
    }

    const token = authorization.split(' ')[1]
    if (!token) {
        return res.status(401).send({ message: 'unAuthorized Access' })
    }

    try {
        const decoded = await admin.auth().verifyIdToken(token)
        req.token_email = decoded.email;
        next()
    } catch (error) {
        return res.status(401).send({ message: 'unAuthorized Access' })

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


        //middlewere
        //verify admin
        const verifyAdmin = async (req, res, next) => {

            const email = req.token_email;

            const user = await usersColl.findOne({ email })
            if (!user) {
                return res.status(404).send({ message: 'user not found' })
            }
            if (user.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next()
        }

        //verify decorator
        const verifyDecorator = async (req, res, next) => {

            const email = req.token_email;

            const user = await usersColl.findOne({ email })
            if (!user) {
                return res.status(404).send({ message: 'user not found' })
            }
            if (user.role !== 'decorator') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next()
        }

        // apis here 

        //--------user Related apis--------
        // add user role 
        app.post('/users', async (req, res) => {
            const { email } = req.body;
            const user = req.body;

            const isExist = await usersColl.findOne({ email })
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
            const { searchText } = req.query;
            const query = searchText
                ? { title: { $regex: searchText, $options: 'i' } }
                : {}
            const result = await serviceColl.find(query).toArray()
            res.send(result)
        })

        //get home page services
        app.get('/services/home', async (req, res) => {
            const result = await serviceColl.find().limit(8).sort({ createdAt: -1 }).toArray()
            res.send(result)
        })

        //get a single service
        app.get('/services/:id', async (req, res) => {
            const { id } = req.params;
            const result = await serviceColl.findOne({ _id: new ObjectId(id) })
            res.send(result)
        })

        // post a service 
        app.post('/services', verifyFBToken, verifyAdmin, async (req, res) => {
            const service = req.body;
            const result = await serviceColl.insertOne(service);
            res.send(result)
        })
        //update a service
        app.patch('/services/:id', verifyFBToken, verifyAdmin, async (req, res) => {
            const { id } = req.params;
            const updateInfo = req.body;
            const update = {
                $set: updateInfo
            }
            const result = await serviceColl.updateOne({ _id: new ObjectId(id) }, update);
            res.send(result)
        })

        //delete a servies
        app.delete('/services/:id', verifyFBToken, verifyAdmin, async (req, res) => {
            const { id } = req.params;
            const result = await serviceColl.deleteOne({ _id: new ObjectId(id) })
            res.send(result)
        })

        //-------assigned bookings Related apis--------

        app.get('/assigned-bookings/:email', verifyFBToken, verifyDecorator, async (req, res) => {
            const { email } = req.params;
            const { status } = req.query;

            const query = {}
            if (status) {
                query.status = status;
            }
            if (email) {
                query.decoratorEmail = email;
            }
            const result = await assignedBookingColl.find(query)
                .sort({ createdAt: -1 }).toArray();
            res.send(result)
        })

        //assigned bookings status assigned but  !completed
        app.get('/assigned-bookings/decorator-earnings-pending/:email', verifyFBToken, verifyDecorator, async (req, res) => {
            const { email } = req.params;

            const query = {
                status: {
                    $nin: ["pending", "Completed"]
                }
            }

            if (email) {
                query.decoratorEmail = email;
            }
            const result = await assignedBookingColl.find(query)
                .sort({ createdAt: -1 }).toArray();
            res.send(result)
        })

        //get assigned bookings today
        app.get('/assigned-bookings/today/:email', verifyFBToken, verifyDecorator, async (req, res) => {
            const { email } = req.params;
            const query = { decoratorEmail: email, bookingDate: new Date().toISOString().split('T')[0] }
            const result = await assignedBookingColl.find(query).sort({ createdAt: -1 }).toArray();
            res.send(result)
        })
        //update assigned bookings 
        app.patch('/assigned-bookings/:bookingId', verifyFBToken, verifyDecorator, async (req, res) => {
            const { bookingId } = req.params;
            const { status } = req.body;

            const update = {
                $set: { status }
            };

            if (status === 'Completed') {
                const assignedBooking = await assignedBookingColl.findOne({
                    _id: new ObjectId(bookingId)
                });

                if (!assignedBooking) {
                    return res.status(404).send({ message: 'Booking not found' });
                }

                if (assignedBooking.status === 'Completed') {
                    return res.send({ message: 'Already Completed' });
                }

                const total = Number(assignedBooking.totalPrice);

                update.$set.decoratorIncome = total * 0.8;
                update.$set.completedAt = new Date();
            }

            const result = await assignedBookingColl.updateOne(
                { _id: new ObjectId(bookingId) },
                update
            );

            res.send(result);
        });


        //post assigned bookings
        app.post('/assigned-bookings', verifyFBToken, verifyAdmin, async (req, res) => {
            const assignedBookingInfo = req.body;
            const result = await assignedBookingColl.insertOne(assignedBookingInfo)
            res.send(result)
        })

        // get assigend books status 
        app.get('/assigned-books/status', verifyFBToken, verifyDecorator, async (req, res) => {
            const pipeline = [
                {
                    $group: {
                        _id: "$status",
                        count: { $sum: 1 }
                    }
                }
            ]
            const result = await assignedBookingColl.aggregate(pipeline).toArray()
            res.send(result)
        })


        //get top decorators
        app.get('/decorators/home', async (req, res) => {
            const result = await decoratorColl.find().limit(5).toArray();
            res.send(result)
        })

        //get top decorators
        app.get('/total-decorators', verifyFBToken, verifyAdmin, async (req, res) => {
            const result = await decoratorColl.find().toArray();
            res.send(result)
        })

        //get all decorators
        app.get('/decorators', verifyFBToken, verifyAdmin, async (req, res) => {
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
        app.post('/decorators', verifyFBToken, verifyAdmin, async (req, res) => {
            const newDecorator = req.body;
            newDecorator.status = 'pending';
            const result = await decoratorColl.insertOne(newDecorator);
            res.send(result)
        })

        //get a decorator 
        app.get('/decorator/:email', async (req, res) => {
            const { email } = req.params;
            const result = await decoratorColl.findOne({ email })
            res.send(result)
        })


        //can update decorator
        app.patch('/decorators/update/:email', verifyFBToken, verifyDecorator, async (req, res) => {
            const { email } = req.params;
            const { status, workingStatus } = req.body;

            const update = { $set: {} }
            if (status) {
                update.$set.status = status;
            }

            if (workingStatus) {
                update.$set.workingStatus = workingStatus;
            }

            const result = await decoratorColl.updateOne({ email }, update)
            res.send(result)
        })
        //can update admin
        app.patch('/decorators/:email', verifyFBToken, verifyAdmin, async (req, res) => {
            const { email } = req.params;
            const { status, workingStatus } = req.body;

            const update = {}
            if (status) {
                update.$set = { status }
            }

            if (workingStatus) {
                update.$set = { workingStatus }
            }

            const result = await decoratorColl.updateOne({ email }, update)
            res.send(result)
        })

        //asign decorator 
        app.patch('/asign/decorator/:id', verifyFBToken, verifyAdmin, async (req, res) => {
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
        app.delete('/decorators/:email', verifyFBToken, verifyAdmin, async (req, res) => {
            const { email } = req.params;
            const result = await decoratorColl.deleteOne({ email })
            res.send(result)
        })

        //--------bookings Related apis--------
        //get all bookings 
        app.get('/all-bookings', verifyFBToken, verifyAdmin, async (req, res) => {
            const result = await bookingColl.find().project({ _id: 1 }).toArray()
            res.send(result)
        })

        //get not pending bookings 
        app.get('/bookings', verifyFBToken, verifyAdmin, async (req, res) => {
            const result = await bookingColl.find({ paymentStatus: { $nin: ["pending"] } }).sort({ createdAt: -1 }).toArray()
            res.send(result)
        })

        //get bookings for a user
        app.get('/bookings/:email', verifyFBToken, async (req, res) => {
            const { email } = req.params;
            if (email !== req.token_email) {
                return res.status(403).status({ message: 'forbidden access' })
            }
            const result = await bookingColl.find({ customerEmail: email }).sort({ createdAt: -1 }).toArray()
            res.send(result)
        })

        //add booking in bookings
        app.post('/bookings', verifyFBToken, async (req, res) => {
            const { email } = req.query;
            if (email !== req.token_email) {
                return res.status(403).send({ message: 'forbidden ' })
            }
            const booking = req.body;
            booking.trackingId = generateTrackingId();
            const result = await bookingColl.insertOne(booking);
            res.send(result)
        })

        //delete a single booking
        app.delete('/bookings/delete/:id', verifyFBToken, async (req, res) => {
            const { id } = req.params;
            const booking = await bookingColl.findOne({ _id: new ObjectId(id) })
            if (!booking) {
                return res.status(404).send({ message: 'booking not found' })
            }
            if (req.token_email !== booking.customerEmail) {
                return res.status(403).send({ message: 'forbidden' })
            }

            const result = await bookingColl.deleteOne({ _id: new ObjectId(id) })
            res.send(result)
        })

        //update a booking
        app.patch('/bookings/:id', verifyFBToken, verifyAdmin, async (req, res) => {
            const { id } = req.params;
            const updateInfo = req.body;
            const update = {
                $set: { ...updateInfo }
            }
            const result = await bookingColl.updateOne({ _id: new ObjectId(id) }, update)
            res.send(result)
        })

        //update a booking status
        app.patch('/bookings/update-status/:serviceId', verifyFBToken, verifyDecorator, async (req, res) => {
            const { serviceId } = req.params;
            const { status } = req.body;
            const update = {
                $set: { status }
            }
            if (status === "Completed") {
                const booking = await bookingColl.findOne({ serviceId })
                if (!booking) {
                    res.status(404).send({ message: 'booking not found' })
                }

                update.$set.adminIncome = Number(booking.totalPrice) * 0.2;
                update.$set.completedAt = new Date();
            }
            const result = await bookingColl.updateOne({ serviceId }, update)
            res.send(result)
        })

        //--------PAYMENT RELATED APIS--------
        // checkout session 
        app.post('/create-checkout-session', async (req, res) => {
            const serviceInfo = req.body;
            const amount = Number(serviceInfo.totalPrice) * 100;
            const session = await stripe.checkout.sessions.create({
                line_items: [
                    {
                        price_data: {
                            currency: 'bdt',
                            unit_amount: amount,
                            product_data: {
                                name: serviceInfo?.title,
                                images: [serviceInfo?.image]

                            },
                        },
                        quantity: 1,
                    }

                ],
                metadata: {
                    serviceName: serviceInfo?.title,
                    serviceId: serviceInfo._id,
                    trackingId: serviceInfo.trackingId
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
            const trackingId = session.metadata.trackingId;
            const transectionId = session.payment_intent;

            // check that is already paid?
            const alreadyPaid = await paymentColl.findOne({ transectionId })
            if (alreadyPaid) {
                return res.send({ status: "already paid", trackingId, transectionId: session.payment_intent })
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


                res.send({ serviceUpdateResult, paymentRes, trackingId, transectionId: session.payment_intent })
            }
        })

        //payment history customer
        app.get('/payment-history/:email', verifyFBToken, async (req, res) => {
            const { email } = req.params;
            if (email !== req.token_email) {
                return res.status(403).send({ message: "forbidden access" })
            }
            const result = await paymentColl.find({ customerEmail: email }).sort({ createdAt: -1 }).toArray()
            res.send(result)
        })

        //get earnings history decorator
        //get monthly total earning
        // app.get('/monthly-total-earnings/decorator/:email', async (req, res) => {
        //     const { email } = req.params;
        //     const pipeline = [
        //         // stage 1
        //         {
        //             $match: {
        //                 paymentType: 'earning',
        //                 decoratorEmail: email,
        //                 paymentStatus: 'paid'
        //             }
        //         },
        //         {
        //             $group: {
        //                 _id: {
        //                     year: { $year: { $dateFromString: { dateString: "$paidAt" } } },
        //                     month: { $month: { $dateFromString: { dateString: "$paidAt" } } }
        //                 },
        //                 totalEarnings: { $sum: "$decoratorEarning" }
        //             }
        //         }
        //     ]

        //     const result = await paymentColl.aggregate(pipeline).toArray();
        //     res.send(result);
        // })

        //total earning
        app.get('/total-earnings/decorator/:email', verifyFBToken, verifyDecorator, async (req, res) => {
            const { email } = req.params;
            const query = { paymentType: 'earning', decoratorEmail: email, paymentStatus: 'paid' }
            const result = await paymentColl.find(query).project({ adminEarning: 0 }).sort({ createdAt: -1 }).toArray()
            res.send(result)
        })

        //pending earning
        app.get('/pending-earnings/decorator/:email', verifyFBToken, verifyDecorator, async (req, res) => {
            const { email } = req.params;
            const query = { paymentType: 'earning', decoratorEmail: email, paymentStatus: 'pending' }
            const result = await paymentColl.find(query).project({ adminEarning: 0 }).sort({ createdAt: -1 }).toArray()
            res.send(result)
        })

        //get earnings admin
        app.get('/total-earnings/admin/:email', verifyFBToken, verifyAdmin, async (req, res) => {
            const query = { paymentType: 'earning' }
            const result = await paymentColl.find(query).toArray()
            res.send(result)
        })
        //add earnings 
        app.post('/total-earnings', verifyFBToken, async (req, res) => {
            const decoratorEarningInfo = req.body;
            const result = await paymentColl.insertOne(decoratorEarningInfo)
            res.send(result)
        })
        //add earnings 
        app.patch('/total-earnings/admin/update/:bookingId', verifyFBToken, verifyAdmin, async (req, res) => {
            const { bookingId } = req.params;
            const updateInfo = req.body;
            const query = { paymentType: 'earning', bookingId }
            const update = ({
                $set: updateInfo
            })
            const result = await paymentColl.updateOne(query, update)
            res.send(result)
        })

        //--------trackings related apis------
        //get singel tracking
        app.get('/track-service/:trackingId', async (req, res) => {
            const { trackingId: trackingId } = req.params;
            const result = await trackingColl.findOne({ trackingId: trackingId })
            res.send(result)
        })

        // get trakckings 
        app.get('/trackings/:trackingId', async (req, res) => {
            const { trackingId } = req.params;
            const result = await trackingColl.find({ trackingId }).toArray()
            res.send(result)
        })

        //add trackings
        app.post('/trackings', verifyFBToken, async (req, res) => {
            const { email } = req.query;
            if (req.token_email !== email) {
                return res.status(403).send({ message: 'forbidden' })
            }
            const newTracking = req.body;
            const result = await trackingColl.insertOne(newTracking);
            res.send(result)
        })

        //update trackings
        app.patch('/trackings/:trackingId', verifyFBToken, verifyDecorator, async (req, res) => {
            const { trackingId } = req.params;
            const { status } = req.body;
            const update = { $addToSet: { trackingStatus: status } }
            const result = await trackingColl.updateOne({ trackingId }, update)
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
