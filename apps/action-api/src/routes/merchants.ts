import {Hono} from "hono"
import {prisma} from "@pulse/database"
import { transactions } from "./transactions"

const merchants = new Hono()

// ENDPOINT 1: GET /merchant/:id
merchants.get("/:id", async (c) => {
    const id = c.req.param("id")

    const merchant = await prisma.merchant.findUnique({
        where: {id},
        select: {
            id: true,
            name: true,
            walletAddress: true,
            splitAddress: true,
            splitPercent: true,
        }
    })

    if(!merchant){
        return c.json({error: "Merchant not found"}, 404)
    }

    return c.json(merchant)
})

// ENDPOINT 2
merchants.get("/:id/transactions", async (c) => {
    const id = c.req.param("id")
    const limit = Number(c.req.query("limit")?? "20")
    const offset = Number(c.req.query("offset") ?? "0")

    const txs = await prisma.transaction.findMany({
        where: {
            session: {
                merchantId: id,
            },
        },
        include: {
            session: {
                select: {
                    amount: true,
                    createdAt: true
                }
            }
        },
        orderBy: {paidAt: "desc"},
        take: limit,
        skip: offset
    })
    return c.json({transactions: txs, limit, offset})
})

export {merchants}
