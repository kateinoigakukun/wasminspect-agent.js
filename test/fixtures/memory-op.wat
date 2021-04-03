(module
    (memory (export "memory") 1)
    (func (export "start"))
    (func (export "internal_store_i32") (param $addr i32) (param $val i32)
        local.get $addr
        local.get $val
        i32.store
    )
    (func (export "internal_read_i32") (param $addr i32) (result i32)
        local.get $addr
        i32.load
    )

    (func (export "internal_store_f32") (param $addr i32) (param $val f32)
        local.get $addr
        local.get $val
        f32.store
    )
    (func (export "internal_read_f32") (param $addr i32) (result f32)
        local.get $addr
        f32.load
    )
)
