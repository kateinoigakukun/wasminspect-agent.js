(module
    (func (export "ret_42") (result i32)
        i32.const 42
    )
    (func (export "with_arg") (param i32) (result i32)
        local.get 0
    )
)
