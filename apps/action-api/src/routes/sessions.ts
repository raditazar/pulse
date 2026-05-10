import {Hono} from "hono"
import {prisma} from "@pulse/database"

const sessions = new Hono()

// ENDPOINT 1: POST /sessions (Buat Session Baru)
sessions.post("/", async (c) => {
    const body = await c.req.json()
    //validation
    const {merchantId, amount} = body
    if (!merchantId || !amount){
        return c.json({error: "merchantId and Amount must be provided"}, 400)
    }

    const session = await prisma.session.create({
        data: {
            merchantId,
            amount, 
            status: "pending",
        },
    })
    return c.json({
        sessionId: session.id,
        checkoutUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/pay/${session.id}`,
    }, 201)
})

// ENDPOINT 2: GET /sessions/:id 
sessions.get("/:id", async (c) => {
    const id = c.req.param("id")

    const session = await  prisma.session.findUnique({
        where: {id},
        include: {
            merchant:{
                select:{
                    id: true,
                    name: true,
                    walletAddress: true,
                    splitAddress: true,
                    splitPercent: true,
                },
            },
        },
    })

    if(!session){
        return c.json({error: "Session not found"}, 404)
    }

    if(session.status === "success"){
        return c.json({error: "Session already paid"})
    }

    return c.json({
        sessionId: session.id,
        amount: session.amount,
        status: session.status,
        merchant: session.merchant
    })
})

export {sessions}