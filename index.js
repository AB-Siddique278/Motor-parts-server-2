const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const { query } = require("express");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5000;

const app = express();

// middleware
app.use(cors());
app.use(express.json());

/* --- MongoDB ---- */



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ewthq.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ message: 'UnAuthorization access' })
  }
  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: 'Forbiden access' })
    }
    req.decoded = decoded;
    next();
  });
}






async function run() {
  try {
    const serviceCollection = client.db('motor_parts').collection('services');
    const bookingCollection = client.db('motor_parts').collection('bookings');
    const userCollection = client.db('motor_parts').collection('users');
    const paymentCollection = client.db('motor_parts').collection('payments');
    const reviewCollection = client.db('motor_parts').collection('review');
    const profileCollection = client.db('motor_parts').collection('profile');
    //for payament method master card 
    app.post('/create-payment-intent', async (req, res) => {
      const service = req.body;
      const price = service.price;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });
      res.send({ clientSecret: paymentIntent.client_secret })
    });







    //for all service
    app.get('/service', async (req, res) => {
      const query = {};
      const cursor = serviceCollection.find(query);
      const services = await cursor.toArray();
      res.send(services);
    });
    //for admin chack if u atre admin u can make access
    app.get('/admin/:email', async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === 'admin';
      res.send({ admin: isAdmin })
    })

    //for Admin
    app.put('/user/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({ email: requester });

      if (requesterAccount.role === 'admin') {
        const filter = { email: email };
        const updateDoc = {
          $set: { role: 'admin' },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
      }
      else {
        res.status(403).send({ message: 'forbiden' });
      }

    })

    // make admin and users
    app.put('/user/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,

      };
      const result = await userCollection.updateOne(filter, updateDoc, options)
      const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })

      res.send({ result, token });
    })




    // service for id
    app.get('/service/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectID(id) };
      const services = await serviceCollection.findOne(query);
      res.send(services);
    })

    //for dashbord bookin show 

    app.get('/booking', verifyJWT, async (req, res) => {
      const customer_email = req.query.customer_email



      const decodedEmail = req.decoded.email
      if (customer_email === decodedEmail) {
        const query = { customer_email: customer_email };
        const bookings = await bookingCollection.find(query).toArray();
        return res.send(bookings);

      }
      else {
        return res.status(403).send({ message: 'forbiden access' })
      }


    });




    app.get('/review', async (req, res) => {
      const query = {};
      const cursor = reviewCollection.find(query);
      const review = await cursor.toArray();
      res.send(review);
    })



    app.post('/review', async (req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });



    //for profile 


    app.get('/profile/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectID(id) };
      const profile = await profileCollection.findOne(query);
      res.send(profile);
    })




    app.get('/profile', async (req, res) => {
      const query = {};
      const cursor = profileCollection.find(query);
      const profile = await cursor.toArray();
      res.send(profile);
    })


    app.post('/profile', async (req, res) => {
      const profile = req.body;
      const result = await profileCollection.insertOne(profile);
      res.send(result);
    });


    //for profile end 




    //    app.put('/profile/:id', async(req, res)=>{
    //        const id = req.params.id;
    //        const updateprofile= req.body;
    //        const filter = {_id: ObjectID(id)};
    //        const options = {upsert: true};
    //        const updatedDoc = {
    //            $set:{
    //              address: updateprofile.address,
    //              mobile: updateprofile.mobile
    //            }
    //        };
    //        const result = await profileCollection.updateOne(filter, updatedDoc, options);
    //        res.send(result);
    //    })








    //for payment booking 
    app.get('/booking/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectID(id) };
      const booking = await bookingCollection.findOne(query);
      res.send(booking);
    })


    //for Add service
    app.post('/service', async (req, res) => {
      const newService = req.body;
      const result = await serviceCollection.insertOne(newService)
      res.send
    })




    //for remove Items
    app.delete('/service/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectID(id) };
      const result = await serviceCollection.deleteOne(query);
      res.send(result);

    })




    //for trangation ID

    app.patch('/booking/:id', async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const filter = { _id: ObjectID(id) };
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        }
      }
      const result = await paymentCollection.insertOne(payment);
      const updatedBooking = await bookingCollection.updateOne(filter, updatedDoc);
      res.send(updatedDoc);
    })












    //for booking service 
    app.post('/booking', async (req, res) => {
      const booking = req.body;
      const result = await bookingCollection.insertOne(booking);
      res.send({ success: true, result });
    });



    //API for all users
    app.get('/user', verifyJWT, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    })

  } finally {
  }
}

run().catch(console.log);

//Basic server start
app.get("/", async (req, res) => {
  res.send(" server is running");
});

app.listen(port, () => console.log(` running on ${port}`));




