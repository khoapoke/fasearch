# Thuật ngữ và tài liệu tham khảo khởi đầu

## Thuật ngữ thống nhất

| Thuật ngữ | Định nghĩa dùng trong đồ án |
|---|---|
| Anchor image | Ảnh tham chiếu trong composed retrieval |
| Target product | Sản phẩm đích được biết khi tạo một composed query |
| Alternate positive | Sản phẩm khác target nhưng vẫn đáp ứng intent |
| Candidate generation | Bước dense/vector retrieval lấy top-N trước rerank |
| Composed retrieval | Retrieval từ ảnh tham chiếu cộng mô tả thay đổi |
| Dense retrieval | Retrieval bằng embedding similarity |
| Taxonomy | Hệ thống category/attribute/semantic value chuẩn hóa |
| Facet | Một thuộc tính có key/value theo taxonomy |
| Gold facet | Facet được human-confirm trong phạm vi judged artifact |
| Production facet | Facet từ tagger/review pipeline đang dùng |
| Intent card | Structured gold description của mục đích query |
| Hard constraint | Điều kiện quyết định exact match; vi phạm làm fail Exact lane |
| Soft preference | Điều kiện dùng rerank, không tự làm fail result |
| Lexicalized negation | Cụm có từ phủ định nhưng là tên thuộc tính, ví dụ không tay |
| Compositional negation | Phủ định logic thật, ví dụ không hoa |
| Lexicalized loanword | Từ mượn fashion đã dùng ổn định trong tiếng Việt, ví dụ denim |
| True code-switch | Chuyển sang cụm tiếng Anh trong câu tiếng Việt |
| Product group | Nhóm duplicate/variant/cross-seller cùng mẫu để split |
| Qrels | Query relevance judgments dùng đánh retrieval |
| TREC pooling | Union top documents từ nhiều runs để chọn pool chấm |
| Graded relevance | Relevance nhiều mức 0 đến 3 |
| Strict relevant | Grade lớn hơn hoặc bằng 2 |
| Relaxed relevant | Grade lớn hơn hoặc bằng 1 |
| TargetRecall | Target designated có trong top-K hay không |
| CandidateRecall | Relevant item có vào candidate top-N trước rerank hay không |
| Ideal@N | Qrels-optimal ordering trong candidate top-N |
| Hard negative | Candidate gần nhưng vi phạm một constraint chính |
| False negative | Item bị dùng làm negative dù thực tế phù hợp |
| Data flywheel | Vòng lỗi và review quay lại cải thiện rules/threshold/model |
| Calibration | Mức confidence phản ánh xác suất đúng thực tế |
| Selective prediction | Model abstain/đẩy review khi không đủ tin cậy |
| Exact lane | Result thỏa mọi hard constraints có thể xác nhận |
| Substitute lane | Result gần nhất sau relaxation được công khai |
| Unverified lane | Result có critical facet UNKNOWN |
| Evidence completeness | Structured evidence đủ required fields |
| Evidence consistency | Evidence tái tính đúng deterministic score/decision |
| Faithfulness | Lời giải thích không vượt quá evidence |
| GA2M | Generalized additive model có một số pairwise interactions |
| FITB | Fill in the blank evaluation cho outfit compatibility |
| VTON | Virtual try-on, tạo visualization người mặc garment |
| SMPL-X | Parametric expressive human body model |
| Frozen test | Test set không dùng cho tuning/prompt/model selection |

## Quy ước module

- RET retrieval encoder.
- CMP composed combiner.
- TAG product attribute tagger.
- PAR query intent parser.
- RER taxonomy reranker.
- EXP evidence verbalizer.
- OUTFIT compatibility scorer.
- VTON virtual try-on.

## Tài liệu tham khảo nền tảng theo IEEE

[1] A. Radford et al., “Learning Transferable Visual Models From Natural Language Supervision,” arXiv:2103.00020, 2021. Available: https://arxiv.org/abs/2103.00020

[2] P. J. Chia et al., “Contrastive Language and Vision Learning of General Fashion Concepts,” arXiv:2204.03972, 2022. Available: https://arxiv.org/abs/2204.03972

[3] G. Chen et al., “mCLIP: Multilingual CLIP via Cross-lingual Transfer,” in Proceedings of ACL, 2023, pp. 13028–13043. doi: 10.18653/v1/2023.acl-long.728. Available: https://aclanthology.org/2023.acl-long.728/

[4] Q.-K. Tran, M.-T. Nguyen, and N.-K. Pham, “ViCLIP-OT: The First Foundation Vision-Language Model for Vietnamese Image-Text Retrieval with Optimal Transport,” arXiv:2602.22678, 2026. Available: https://arxiv.org/abs/2602.22678

[5] H. Wu et al., “Fashion IQ: A New Dataset Towards Retrieving Images by Natural Language Feedback,” in Proceedings of CVPR, 2021, pp. 11307–11317. Available: https://openaccess.thecvf.com/content/CVPR2021/html/Wu_Fashion_IQ_A_New_Dataset_Towards_Retrieving_Images_by_Natural_CVPR_2021_paper.html

[6] A. Baldrati, M. Bertini, T. Uricchio, and A. Del Bimbo, “Effective Conditioned and Composed Image Retrieval Combining CLIP-Based Features,” in Proceedings of CVPR, 2022. Available: https://openaccess.thecvf.com/content/CVPR2022/papers/Baldrati_Effective_Conditioned_and_Composed_Image_Retrieval_Combining_CLIP-Based_Features_CVPR_2022_paper.pdf

[7] Y. Ge et al., “DeepFashion2: A Versatile Benchmark for Detection, Pose Estimation, Segmentation and Re-Identification of Clothing Images,” in Proceedings of CVPR, 2019. Available: https://openaccess.thecvf.com/content_CVPR_2019/papers/Ge_DeepFashion2_A_Versatile_Benchmark_for_Detection_Pose_Estimation_Segmentation_and_CVPR_2019_paper.pdf

[8] A. Rostam Mani et al., “Fashion-Gen: The Generative Fashion Dataset and Challenge,” arXiv:1806.08317, 2018. Available: https://arxiv.org/abs/1806.08317

[9] M. I. Vasileva et al., “Learning Type-Aware Embeddings for Fashion Compatibility,” in Proceedings of ECCV, 2018. Available: https://openaccess.thecvf.com/content_ECCV_2018/papers/Mariya_Vasileva_Learning_Type-Aware_Embeddings_ECCV_2018_paper.pdf

[10] X. Han, Z. Wu, Y.-G. Jiang, and L. S. Davis, “Learning Fashion Compatibility with Bidirectional LSTMs,” arXiv:1707.05691, 2017. Available: https://arxiv.org/abs/1707.05691

[11] Y. Lou, R. Caruana, J. Gehrke, and G. Hooker, “Accurate Intelligible Models with Pairwise Interactions,” in Proceedings of KDD, 2013. Available: https://yinlou.github.io/papers/lou-kdd13.pdf

[12] K. Järvelin and J. Kekäläinen, “Cumulated Gain-based Evaluation of IR Techniques,” ACM Transactions on Information Systems, vol. 20, no. 4, pp. 422–446, 2002. doi: 10.1145/582415.582418.

[13] J. Cohen, “Weighted Kappa: Nominal Scale Agreement with Provision for Scaled Disagreement or Partial Credit,” Psychological Bulletin, vol. 70, no. 4, pp. 213–220, 1968. doi: 10.1037/h0026256.

[14] National Institute of Standards and Technology, “How To TREC,” accessed Sep. 5, 2026. Available: https://trec.nist.gov/howto.html

[15] J. Savoy, “Statistical Inference in Retrieval Effectiveness Evaluation,” Information Processing and Management, vol. 33, no. 4, pp. 495–512, 1997. doi: 10.1016/S0306-4573(97)00027-7.

[16] G. Pavlakos et al., “Expressive Body Capture: 3D Hands, Face, and Body from a Single Image,” in Proceedings of CVPR, 2019. Project: https://smpl-x.is.tue.mpg.de/

[17] S. Choi et al., “VITON-HD: High-Resolution Virtual Try-On via Misalignment-Aware Normalization,” in Proceedings of CVPR, 2021, pp. 14131–14140. Available: https://openaccess.thecvf.com/content/CVPR2021/papers/Choi_VITON-HD_High-Resolution_Virtual_Try-On_via_Misalignment-Aware_Normalization_CVPR_2021_paper.pdf

[18] Y. Choi, S. Kwak, K. Lee, H. Choi, and J. Shin, “Improving Diffusion Models for Authentic Virtual Try-On in the Wild,” in Proceedings of ECCV, 2024. Available: https://arxiv.org/abs/2403.05139

## Ghi chú dùng references

- Kiểm tra lại BibTeX, tên tác giả, trang và access date khi chốt báo cáo.
- Dùng một chuẩn duy nhất theo yêu cầu khoa; danh sách trên đang ở IEEE starter format.
- Cite primary paper/project page thay vì blog tổng hợp khi mô tả phương pháp.
- ViCLIP-OT là preprint mới tại thời điểm lập tài liệu; ghi đúng trạng thái và checkpoint audit.
- Dataset/model license được ghi trong data/model card, không suy ra chỉ từ paper.
