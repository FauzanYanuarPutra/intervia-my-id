#![cfg_attr(not(test), allow(dead_code))]

pub(crate) mod integrity;
pub(crate) mod state;

#[cfg(test)]
mod tests;
