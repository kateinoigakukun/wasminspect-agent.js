(module
    (func $js_ret_42 (import "host_env" "js_ret_42") (result i32))
    (func $js_with_arg (import "host_env" "js_with_arg") (param i32) (result i32))
    (func (export "call_js_ret_42") (result i32)
        call $js_ret_42
    )
    (func (export "call_js_with_arg") (param i32) (result i32)
        local.get 0
        call $js_with_arg
    )
)
