import {lembagaProcedure} from "../../trpc";
import {events} from "~/server/db/schema";
import {TRPCError} from "@trpc/server";
import { CreateEventInputSchema, CreateEventOutputSchema } from "../../types/event.type";

function generateShortId(byteLength = 8) {
    const array = new Uint8Array(byteLength);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, "0")).join("");
}

export const createEvent = lembagaProcedure 
    .input(CreateEventInputSchema)
    .output(CreateEventOutputSchema)
    .mutation(async ({ctx, input}) => {
        try {
            const newEvent = await ctx.db.insert(events).values({
                id: generateShortId(),
                org_id: ctx.session.user.lembagaId,
                ...input,
                start_date: new Date(input.start_date),
                end_date: input.end_date ? new Date(input.end_date) : null
            }).returning();

            if (!newEvent[0]) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: "Gagal membuat kegiatan."
                });
            }

            return newEvent[0];

        } catch (error) {
            if (error instanceof TRPCError) {
                throw error;
            }
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: "Terjadi kesalahan tak terduga saat membuat kegiatan."
            });
        }
    })