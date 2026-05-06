use anchor_lang::prelude::*;

declare_id!("Pulse1111111111111111111111111111111111111");

#[program]
pub mod pulse_payment {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

