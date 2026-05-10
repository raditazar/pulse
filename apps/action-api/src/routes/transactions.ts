import {Hono} from "hono"
import {prisma} from "@pulse/database"

const transactions = new Hono()

// ENDPOINT 1: POST /transactions (Record Transaction)
transactions.post("/", async (c) => {
    const body = await c.req.json()
    
    const {
        sessionId, 
        txSignature,
        payerAddress,
        merchantAmount,
        splitAmount,
        tokenMint,
        chain,
    } = body

    // Validation
    if(!sessionId || !txSignature || !payerAddress || !merchantAmount || !splitAmount){
        return c.json({error: "Field required: sessionId, txSignature, payerAddress, merchantAmount, splitAmount"}, 400)
    }
    const session = await prisma.session.findUnique({
        where: {id: sessionId},
    })

    if(!session){
        return c.json({error: "Session not found"}, 404)
    }

    if(session.status === "success"){
        return c.json({error: "Session already paid"}, 400)
    }

    // Save transaction and update session status
    const [transaction] = await prisma.$transaction([
        prisma.transaction.create({
            data: {
                sessionId,
                txSignature,
                payerAddress,
                merchantAmount,
                splitAmount,
                tokenMint: tokenMint ?? null,
                chain: chain ?? "solana",
            },
        }),
        prisma.session.update({
            where: {id: sessionId},
            data: {status: "success"}
        })
    ])

    return c.json({
        success: true,
        transactionId: transaction.id,
        txSignature: transaction.txSignature,
    }, 201)
})

export {transactions}
