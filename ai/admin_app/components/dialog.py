
import streamlit as st


@st.dialog("Xác nhận Reset dữ liệu")
def confirm_reset_dialog(current_col, point_srv):

    st.warning(
        f"Bạn có chắc chắn muốn RESET toàn bộ dữ liệu "
        f"trong collection '{current_col}' không?"
    )

    st.error("Thao tác này không thể hoàn tác!")

    col1, col2 = st.columns(2)

    with col1:
        cancel = st.button("Hủy", use_container_width=True)

    with col2:
        confirm = st.button(
            "Xác nhận Reset",
            type="primary",
            use_container_width=True
        )

    if cancel:
        st.rerun()

    if confirm:
        try:
            with st.spinner("Đang làm sạch dữ liệu..."):
                point_srv.clear_all_points()

            st.success("Reset dữ liệu thành công!")
            st.rerun()

        except Exception as ex:
            st.error(f"Lỗi khi reset: {ex}")



@st.dialog("Xác nhận xóa Collection")
def confirm_delete_dialog(current_col, point_srv, default_col):

    st.warning(
        f"Bạn có chắc chắn muốn xóa hoàn toàn "
        f"collection '{current_col}' không?"
    )

    st.error(
        "Toàn bộ dữ liệu trong collection sẽ bị xóa và không thể khôi phục!"
    )

    col1, col2 = st.columns(2)

    with col1:
        cancel = st.button(
            "Hủy",
            use_container_width=True
        )

    with col2:
        confirm = st.button(
            "Xác nhận xóa",
            type="primary",
            use_container_width=True
        )

    if cancel:
        st.rerun()

    if confirm:
        try:
            with st.spinner(
                f"Đang xóa collection '{current_col}'..."
            ):
                point_srv.delete_collection()

            st.session_state["selected_collection"] = default_col

            st.success(
                f"Đã xóa hoàn toàn collection '{current_col}'!"
            )

            st.rerun()

        except Exception as ex:
            st.error(f"Lỗi khi xóa collection: {ex}")
